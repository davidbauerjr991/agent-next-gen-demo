import type { ScenarioScript } from "../scenario-script";

// Maya Chen: a cold inbound voice call, answered automatically (no accept or
// decline), about a refund for a damaged espresso machine. Customer and case
// details are from the Agentic Workspace demo (CASE-30402: cracked water tank
// on NR-10871, $412.00). Ported from
// agent-next-gen-maya-chen-refund-call-scenario.ts; the page still reads that
// module until P0.5c moves the scenario onto the engine.
export const MAYA_CHEN_SCRIPT = {
  version: 1,
  id: "maya-chen-refund-call",
  title: "Maya Chen: damaged espresso machine",
  summary: "A cold call that connects at once, about a $412.00 refund for NR-10871.",
  // The demo shows no number for Maya; this one is a placeholder.
  entity: { key: "maya-chen-refund-call", name: "Maya Chen", caseId: "CASE-30402", phone: "(646) 555-0143" },
  channel: "voice",
  skill: { name: "Returns" },
  participants: { agent: "John Smith" },
  start: { answer: "auto" },
  launch: { hotkey: "B" },
  steps: [
    {
      id: "mcc-1",
      kind: "say",
      speaker: "customer",
      anchor: "answered",
      at: 1200,
      text: "Hi, this is Maya Chen. The water tank on my espresso machine arrived cracked. I'd like a refund, not a replacement.",
    },
    {
      id: "mcc-2",
      kind: "say",
      speaker: "agent",
      anchor: "answered",
      at: 7000,
      text: "I'm sorry about that, Maya, I'm John. Let me pull up your order and the photo you sent.",
    },
    {
      id: "mcc-3",
      kind: "say",
      speaker: "customer",
      anchor: "answered",
      at: 12000,
      text: "It's order NR-10871, the $412 espresso machine, paid with my Visa. I'll buy a different model instead.",
    },
  ],
  content: {
    panelKeys: ["maya-order", "maya-card", "maya-refund-steps"],
    overview: {
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
    },
    copilot: {
      suggestions: ["Show the order", "Show the card on file", "How do I refund a damaged item?"],
      links: {
        "Show the order": "maya-order",
        "Show the card on file": "maya-card",
        "How do I refund a damaged item?": "maya-refund-steps",
      },
    },
  },
} satisfies ScenarioScript;
