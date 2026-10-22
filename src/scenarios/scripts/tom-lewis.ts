import type { ScenarioScript } from "../scenario-script";

// Tom Lewis: a cold inbound voice call (no AI agent) about voiding a duplicate
// charge. Customer and case details are from the Agentic Workspace demo
// (CASE-30409: charged twice on two cards). Ported in P0.7 from the page's
// old scenario module; the sim engine plays it since P0.5c.
export const TOM_LEWIS_SCRIPT = {
  version: 1,
  id: "tom-lewis-void-call",
  title: "Tom Lewis: duplicate charge",
  summary: "A cold incoming call to void one of two $86.40 charges on order NR-50877. The agent accepts, then the call plays.",
  entity: { key: "tom-lewis-void-call", name: "Tom Lewis", caseId: "CASE-30409", phone: "(312) 555-0187" },
  channel: "voice",
  skill: { name: "Billing", id: "billing" },
  participants: { agent: "John Smith" },
  start: { answer: "agent", caseStatus: "Open" },
  launch: { hotkey: "C" },
  steps: [
    {
      id: "tlc-greet",
      kind: "guide",
      anchor: "answered",
      at: 0,
      nba: {
        type: "say",
        title: "Greet Tom and say the call is recorded",
        why: "Every contact opens with a greeting and the recording notice.",
        text: "Hi Tom, thanks for calling. My name is John. This call is recorded for quality and training.",
        alt: [
          { type: "say", text: "Identify yourself" },
          { type: "ask", text: "Confirm the callback number" },
        ],
      },
    },
    {
      id: "tlc-1",
      kind: "say",
      speaker: "customer",
      anchor: "answered",
      at: 1200,
      text: "Hi, this is Tom Lewis. I was charged twice for one order, once on my Visa and once on my Mastercard. I need one of those charges voided.",
    },
    {
      id: "tlc-2",
      kind: "say",
      speaker: "agent",
      anchor: "answered",
      at: 7000,
      text: "Thanks for calling, Tom, I'm John. Let me pull up your order and both charges.",
    },
    {
      id: "tlc-3",
      kind: "say",
      speaker: "customer",
      anchor: "answered",
      at: 12000,
      text: "It's order NR-50877, $86.40. I only placed it once, and I'd rather keep the Mastercard charge since that's my default card.",
      // The card on file: Customer Info comes forward.
      focus: "customer",
    },
    {
      id: "tlc-ask",
      kind: "guide",
      anchor: "answered",
      at: 2500,
      nba: {
        type: "ask",
        title: "Ask which charge Tom wants to keep",
        why: "Both cards were charged $86.40 for one order; void the one he doesn't want.",
        text: "I can see both charges. Which card would you like to keep the charge on?",
        alt: [{ type: "say", text: "Tell Tom only one order was placed" }],
      },
    },
    {
      id: "tlc-do",
      kind: "guide",
      anchor: "answered",
      at: 13_500,
      nba: {
        type: "do",
        title: "Void the $86.40 charge on Visa 2210",
        why: "Tom keeps the Mastercard 9031 charge, his default card; the Visa charge is the duplicate.",
        action: "Runs the void flow on NR-50877 and opens its steps",
        link: "void-steps",
        branch: "void",
        alt: [{ type: "say", text: "Tell Tom the refund takes 3 to 5 business days" }],
      },
    },
  ],
  branches: {
    void: {
      label: "The agent voids the duplicate charge",
      trigger: "action",
      steps: [
        { id: "void-1", kind: "event", at: 300, text: "Visa 2210 charge of $86.40 voided" },
        {
          id: "void-2",
          kind: "say",
          speaker: "agent",
          at: 1500,
          text: "I've voided the $86.40 charge on your Visa ending 2210. The Mastercard charge stays, and the Visa refund shows in 3 to 5 business days.",
        },
        { id: "void-3", kind: "say", speaker: "customer", at: 5000, text: "Great, thanks for fixing that." },
      ],
    },
  },
  content: {
    panelKeys: ["order", "card", "void-steps"],
    overview: {
      subtitle: "Member since 2021 · 3 orders",
      tags: ["Member", "Prefers voice", "Mastercard 9031 default"],
      detailedSummary: [
        "Member since 2021 with 3 orders. Prefers voice for support and asked for a person on his last 2 calls. Made Mastercard 9031 his default card on Sep 27.",
        "Today order NR-50877 ($86.40) was charged twice, once on Visa 2210 and once on Mastercard 9031, but only one order was placed. He requested a refund in the app this morning.",
      ],
      journeySummary:
        "Tom is calling to void one of two $86.40 charges on order NR-50877, one on Visa 2210 and one on Mastercard 9031. Only one order was placed. A duplicate-charge review is at stage 3 of 5. He sounds annoyed.",
      snapshot: [
        "Calling to void one of two $86.40 charges on [order NR-50877](order).",
        "Charged on Visa 2210 and Mastercard 9031; only one order was placed.",
        "Prefers to keep the charge on his [Mastercard 9031](card) card on file, his default since Sep 27.",
      ],
      nextBestAction:
        "Confirm both $86.40 charges in payments, then void the Visa 2210 charge on NR-50877 and tell Tom how long the refund will take.",
    },
    journey: {
      summary: "Tom requested a refund in the app this morning; he asked for a person on his last 2 calls.",
      rows: [
        { name: "Today · App", detail: "Refund request for the duplicate charge on NR-50877" },
        { name: "27 Sep · Web", detail: "Made Mastercard 9031 his default card" },
        { name: "12 Sep · Voice", detail: "Asked for a person; delivery question answered" },
      ],
    },
    copilot: {
      suggestions: ["Show the charges", "Show the card on file", "How do I void a charge?"],
      links: {
        "Show the charges": "order",
        "Show the card on file": "card",
        "How do I void a charge?": "void-steps",
      },
    },
  },
} satisfies ScenarioScript;
