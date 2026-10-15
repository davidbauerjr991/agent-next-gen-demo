import type { ScenarioScript } from "../scenario-script";

// Tom Lewis: a cold inbound voice call (no AI agent) about voiding a duplicate
// charge. Customer and case details are from the Agentic Workspace demo
// (CASE-30409: charged twice on two cards). Ported from
// agent-next-gen-tom-lewis-void-call-scenario.ts; the page still reads that
// module until P0.5c moves the scenario onto the engine.
export const TOM_LEWIS_SCRIPT = {
  version: 1,
  id: "tom-lewis-void-call",
  title: "Tom Lewis: duplicate charge",
  summary: "A cold incoming call to void one of two $86.40 charges on order NR-50877. The agent accepts, then the call plays.",
  entity: { key: "tom-lewis-void-call", name: "Tom Lewis", caseId: "CASE-30409", phone: "(312) 555-0187" },
  channel: "voice",
  skill: { name: "Billing", id: "billing" },
  participants: { agent: "John Smith" },
  start: { answer: "agent" },
  launch: { hotkey: "C" },
  steps: [
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
    },
  ],
  content: {
    panelKeys: ["order", "card", "void-steps"],
    overview: {
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
