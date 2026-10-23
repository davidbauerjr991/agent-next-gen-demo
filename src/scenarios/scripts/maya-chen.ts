import type { ScenarioScript } from "../scenario-script";

// Maya Chen: a cold inbound voice call, answered automatically (no accept or
// decline), about a refund for a damaged espresso machine. Customer and case
// details are from the Agentic Workspace demo (CASE-30402: cracked water tank
// on NR-10871, $412.00). Ported in P0.7 from the page's old scenario module;
// the sim engine plays it since P0.5c.
export const MAYA_CHEN_SCRIPT = {
  version: 1,
  id: "maya-chen-refund-call",
  title: "Maya Chen: damaged espresso machine",
  summary: "A cold call that connects at once, about a $412.00 refund for NR-10871.",
  // The demo shows no number for Maya; this one is a placeholder.
  entity: { key: "maya-chen-refund-call", name: "Maya Chen", caseId: "CASE-30402", phone: "(646) 555-0143" },
  channel: "voice",
  skill: { name: "Returns", id: "returns" },
  participants: { agent: "John Smith" },
  start: { answer: "auto", caseStatus: "Open" },
  launch: { hotkey: "B" },
  // Every agent line carries a Next Best Action: the agent's turn waits on it (P-CANVAS), so John never speaks
  // unprompted. Times are the script's own; while it waits, every later step keeps its remaining delay.
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
      at: 1400,
      text: "I'm sorry about that, Maya, I'm John. This call is recorded for quality and training. Let me pull up your order and the photo you sent.",
      nba: {
        type: "say",
        title: "Greet Maya and say the call is recorded",
        why: "Every contact opens with a greeting and the recording notice.",
        text: "Hi Maya, I'm sorry about the tank. My name is John, and this call is recorded for quality and training.",
        alt: [
          { type: "say", text: "Identify yourself" },
          { type: "ask", text: "Confirm the callback number" },
        ],
      },
    },
    {
      id: "mcc-3",
      kind: "say",
      speaker: "customer",
      anchor: "answered",
      at: 5000,
      text: "It's order NR-10871, the $412 espresso machine, paid with my Visa. I'll buy a different model instead.",
      // The card on file: Customer Info comes forward.
      focus: "customer",
    },
    {
      id: "mcc-ask",
      kind: "say",
      speaker: "agent",
      anchor: "answered",
      at: 5300,
      text: "Thanks, Maya. And you sent us a photo of the cracked tank through the app?",
      nba: {
        type: "ask",
        title: "Confirm the damage photo",
        why: "A refund for a damaged item needs a photo check that passed (RET-1.3).",
        text: "Could you confirm you sent us a photo of the cracked tank?",
        alt: [{ type: "say", text: "Tell Maya a refund is within your limit" }],
      },
    },
    {
      id: "mcc-4",
      kind: "say",
      speaker: "customer",
      anchor: "answered",
      at: 8500,
      text: "Yes, I uploaded it in the app this morning.",
    },
    {
      id: "mcc-do",
      kind: "say",
      speaker: "agent",
      anchor: "answered",
      at: 8800,
      text: "Thank you. I'm refunding the $412.00 to your Visa ending 4417 now.",
      nba: {
        type: "do",
        title: "Refund $412.00 to Visa 4417",
        why: "The photo check passed and $412.00 is within your $500 refund limit.",
        action: "Runs the refund flow under RET-1.3 and opens its steps",
        link: "maya-refund-steps",
        branch: "refund",
        alt: [{ type: "say", text: "Tell Maya the refund posts in 3 to 5 business days" }],
      },
    },
    {
      id: "mcc-5",
      kind: "say",
      speaker: "customer",
      anchor: "answered",
      at: 12_000,
      text: "Do I need to send the machine back before the refund goes through?",
    },
    {
      id: "mcc-6",
      kind: "say",
      speaker: "agent",
      anchor: "answered",
      at: 12_300,
      text: "No need to wait: keep it until the prepaid return label arrives by email. The refund usually posts in 3 to 5 business days.",
      nba: {
        type: "say",
        title: "Tell Maya she can keep it until the return label arrives",
        why: "RET-1.3 refunds damaged items before the return; the prepaid label follows by email.",
        text: "You don't need to send it back first. A prepaid return label is on its way by email, and the refund posts in 3 to 5 business days.",
        alt: [{ type: "ask", text: "Ask if there's anything else" }],
      },
    },
    { id: "mcc-7", kind: "say", speaker: "customer", anchor: "answered", at: 16_000, text: "Perfect, thank you. I'll watch for the label." },
  ],
  branches: {
    // Run it on the refund suggestion: the refund happens; John's own line then plays.
    refund: {
      label: "The agent refunds Maya",
      trigger: "action",
      steps: [{ id: "refund-1", kind: "event", at: 300, text: "Refund of $412.00 to Visa 4417 issued" }],
    },
  },
  content: {
    panelKeys: ["maya-order", "maya-card", "maya-refund-steps"],
    overview: {
      subtitle: "Member since 2022 · 6 orders",
      tags: ["Member", "Prefers email", "Rated last 3 contacts 5 of 5"],
      detailedSummary: [
        "Member since 2022 with 6 orders. Prefers email, rated her last 3 contacts 5 of 5, and paid with Visa 4417 on her last 2 orders. This is her first damage claim in 2 years.",
        "Her espresso machine (order NR-10871, $412.00, Sep 25) arrived with a cracked water tank. She submitted a return request in the app and a refund review is at stage 3 of 5.",
      ],
      journeySummary:
        "Maya is calling for a refund on the espresso machine from order NR-10871 ($412.00), which arrived with a cracked water tank. She wants a refund, not a replacement. The photo check passed and the refund is within your $500 limit. She sounds disappointed.",
      snapshot: [
        "Calling for a $412.00 refund on [order NR-10871](maya-order), an espresso machine that arrived with a cracked water tank.",
        "Wants a refund, not a replacement; the damage photo check passed.",
        "Paid with [Visa 4417](maya-card); refunds up to $500 with a confirmed photo check are within your limit ([RET-1.3](maya-refund-steps)).",
      ],
      nextBestAction:
        "Refund $412.00 to Visa 4417 under RET-1.3, email the prepaid return label, and tell Maya the refund usually posts in 3 to 5 business days.",
    },
    journey: {
      summary: "Maya filed a return request in the app this morning; it's her first damage claim in 2 years.",
      rows: [
        { name: "Today · App", detail: "Return request for NR-10871 with a photo of the cracked tank" },
        { name: "27 Sep · Email", detail: "NR-10871 delivered; no issue reported then" },
        { name: "25 Sep · Web", detail: "Ordered the espresso machine ($412.00) with Visa 4417" },
      ],
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
