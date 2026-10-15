import type { ScenarioScript } from "../scenario-script";

// Marcus Webb: an inbound voice call a Cognigy virtual agent already handled.
// A $200 refund for damaged headphones is above the bot's $100 limit, so it
// asks the customer to hold and flags a human to review. The contact reaches
// the agent held, in review; the agent reads along and can take over. The
// whole conversation is in the past at launch, so nothing plays live.
//
// Ported from the inline MARCUS_WEBB_CALL_TRANSCRIPT in
// AgentWorkspaceAdvancedPage.tsx (which still reads it until P0.5c). The
// customer is not a directory customer by design (his lyra record id is only
// the scenario card's id). His Next Best Action card and panels are
// components with their own content; the overview comes from the generic
// builder, not from this script.
export const MARCUS_WEBB_SCRIPT = {
  version: 1,
  id: "marcus-webb-scenario",
  title: "Marcus Webb: refund above the bot's limit",
  summary: "A bot-handled voice call held for human review: a $200 refund the virtual agent can't approve.",
  // The page gives his call no number; this one is a placeholder.
  entity: { key: "marcus-webb-scenario", name: "Marcus Webb", caseId: "MW-DEMO-0001", directoryId: "marcus-webb-scenario", phone: "(415) 555-0118" },
  channel: "voice",
  skill: { name: "AI Review" },
  participants: { bot: "Cognigy AI Agent" },
  start: { answer: "delivered", review: true, ageMs: 180_000 },
  launch: { hotkey: "L" },
  steps: [
    {
      id: "mw-t1",
      kind: "say",
      speaker: "bot",
      at: -180_000,
      text: "Thanks for calling in — I'm the virtual assistant today. Can you tell me a bit about what's going on?",
    },
    {
      id: "mw-t2",
      kind: "say",
      speaker: "customer",
      at: -170_000,
      text: "Hi, yeah — I ordered a pair of noise-cancelling headphones and they showed up with a cracked ear cup. I'd like a refund.",
    },
    {
      id: "mw-t3",
      kind: "say",
      speaker: "bot",
      at: -120_000,
      text: "I'm sorry to hear that — a damaged item on arrival definitely qualifies for a refund. Let me pull up your order.",
    },
    {
      id: "mw-t4",
      kind: "say",
      speaker: "customer",
      at: -105_000,
      text: "Sure, it's order number 48213, placed last Tuesday.",
    },
    {
      id: "mw-t5",
      kind: "say",
      speaker: "bot",
      at: -60_000,
      text: "Found it — the headphones on that order are valued at $200. I'm authorized to approve refunds up to $100 on my own, so this one comes in just above what I can approve directly.",
    },
    {
      id: "mw-t6",
      kind: "say",
      speaker: "bot",
      at: -50_000,
      text: "I'll need to check with a supervisor before I can process it. Would you mind holding for a moment while I flag this for a human agent to review?",
    },
    {
      id: "mw-t7",
      kind: "say",
      speaker: "customer",
      at: -20_000,
      text: "That's fine, I can hold.",
    },
    {
      id: "mw-t8",
      kind: "say",
      speaker: "bot",
      at: -10_000,
      text: "Thank you for your patience — please hold while I connect with a supervisor for approval on this $200 refund.",
    },
  ],
  content: { panelKeys: [] },
} satisfies ScenarioScript;
