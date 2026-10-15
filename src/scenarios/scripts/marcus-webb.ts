import type { ScenarioScript } from "../scenario-script";

// Marcus Webb: an inbound voice call a Cognigy virtual agent already handled.
// A $200 refund for damaged headphones is above the bot's $100 limit, so it
// asks the customer to hold and flags a human to review. The contact reaches
// the agent in review; the agent reads along and can take over. The setup
// conversation is in the past at launch; the lines after it are the action
// branches below, which his Next Best Action card starts step by step.
//
// Ported from the inline MARCUS_WEBB_CALL_TRANSCRIPT in
// AgentWorkspaceAdvancedPage.tsx. The customer is not a directory customer
// by design (his lyra record id is only the scenario card's id). His Next
// Best Action card and panels are components with their own content and
// timing; the overview comes from the generic builder, not from this script.
export const MARCUS_WEBB_SCRIPT = {
  version: 1,
  id: "marcus-webb-scenario",
  title: "Marcus Webb: refund above the bot's limit",
  summary: "A bot-handled voice call held for human review: a $200 refund the virtual agent can't approve.",
  // The page gives his call no number; this one is a placeholder.
  entity: { key: "marcus-webb-scenario", name: "Marcus Webb", caseId: "MW-DEMO-0001", directoryId: "marcus-webb-scenario", phone: "(415) 555-0118" },
  channel: "voice",
  skill: { name: "AI Review", id: "ai-review" },
  participants: { bot: "Cognigy AI Agent" },
  start: { answer: "delivered", review: true, ageMs: 180_000, caseStatus: "Open" },
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
  // The Next Best Action card's steps start these (`trigger: "action"`); the
  // card keeps its own step timing. Each is one line, said when its step
  // lands. Moved verbatim from the Advanced page's NBA callbacks (P0.5c).
  branches: {
    "approved": {
      label: "Refund approved: the bot tells Marcus",
      trigger: "action",
      steps: [
        {
          id: "mw-approved-1",
          kind: "say",
          speaker: "bot",
          at: 0,
          text: "Great news — I've received approval from a supervisor. I'm processing your $200 refund now; you should see it back on your original payment method within 3-5 business days. Is there anything else I can help with?",
        },
      ],
    },
    "customer-thanks": {
      label: "Marcus thanks the bot",
      trigger: "action",
      steps: [{ id: "mw-thanks-1", kind: "say", speaker: "customer", at: 0, text: "That's great, thank you so much for your help!" }],
    },
    "rejected": {
      label: "Refund rejected: the bot offers alternatives",
      trigger: "action",
      steps: [
        {
          id: "mw-rejected-1",
          kind: "say",
          speaker: "bot",
          at: 0,
          text: "Thanks for holding — I heard back from a supervisor, and unfortunately this refund wasn't approved as submitted. I'd like to offer you a replacement or store credit instead — which would you prefer?",
        },
      ],
    },
    "rejection-reaction": {
      label: "Marcus reacts to the rejection",
      trigger: "action",
      steps: [
        {
          id: "mw-rejection-reaction-1",
          kind: "say",
          speaker: "customer",
          at: 0,
          text: "Wait, seriously? I've been more than patient about this — I really don't understand why it's being denied.",
        },
      ],
    },
    "photo-requested": {
      label: "The bot asks for a photo",
      trigger: "action",
      steps: [
        {
          id: "mw-photo-requested-1",
          kind: "say",
          speaker: "bot",
          at: 0,
          text: "Understood — to help us evaluate this further, could you send a photo of the damaged ear cup?",
        },
      ],
    },
    "photo-reaction": {
      label: "Marcus reacts to the photo request",
      trigger: "action",
      steps: [
        {
          id: "mw-photo-reaction-1",
          kind: "say",
          speaker: "customer",
          at: 0,
          text: "Are you kidding me? I already explained what happened. Fine, I'll send a photo, but this is getting frustrating.",
        },
      ],
    },
    "takeover-greeting": {
      label: "The agent greets Marcus after taking over",
      trigger: "action",
      steps: [
        {
          id: "mw-takeover-greeting-1",
          kind: "say",
          speaker: "agent",
          at: 0,
          text: "Hello, Mr. Webb. This is John. I noticed you are not happy about your headphones. Would you be interested in store credit or a discount?",
        },
      ],
    },
    "takeover-reply": {
      label: "Marcus picks store credit",
      trigger: "action",
      steps: [{ id: "mw-takeover-reply-1", kind: "say", speaker: "customer", at: 0, text: "I'll take store credit." }],
    },
    "remedy-store-credit": {
      label: "The agent issues store credit",
      trigger: "action",
      inputs: ["storeCreditAmount"],
      steps: [
        {
          id: "mw-remedy-store-credit-1",
          kind: "say",
          speaker: "agent",
          at: 0,
          text: "Perfect — I've issued ${storeCreditAmount} as store credit to your account; you'll see it available for your next purchase.",
        },
      ],
    },
    "remedy-discount-code": {
      label: "The agent sends a discount code",
      trigger: "action",
      inputs: ["discountPercent"],
      steps: [
        {
          id: "mw-remedy-discount-code-1",
          kind: "say",
          speaker: "agent",
          at: 0,
          text: "Great — I've sent a {discountPercent}% discount code for your next order to the email on file.",
        },
      ],
    },
    "remedy-other": {
      label: "The agent does something else",
      trigger: "action",
      inputs: ["note"],
      steps: [{ id: "mw-remedy-other-1", kind: "say", speaker: "agent", at: 0, text: "Understood — I'll go ahead and take care of that: {note}" }],
    },
  },
  content: { panelKeys: [] },
} satisfies ScenarioScript;
