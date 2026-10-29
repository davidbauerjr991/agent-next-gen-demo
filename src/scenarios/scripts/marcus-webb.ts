import type { ScenarioScript } from "../scenario-script";

// Marcus Webb: an inbound voice call a Cognigy virtual agent already handled.
// A $200 refund for damaged headphones is above the bot's $100 limit, so it
// asks the customer to hold and flags a human to review. The contact reaches
// the agent in review; the agent reads along and can take over. The setup
// conversation is in the past at launch.
//
// P-SHRINK: every decision is a Next Best Action on a guide step (the agent's
// turn; it surfaces while the bot holds the call, and taking over withdraws
// it): approve or reject (with a reason), and after takeover the greeting and
// the remedy. Each starts an action branch below, which plays the AI agent's
// work as a work-item row (an instruction beat), the bot's and Marcus's lines,
// and event rows; the disposition and status changes are the events' `sets`.
// "Something else" is the Copilot composer. The bodies the rows open are in
// agent-next-gen-marcus-webb-panels.tsx. The overview comes from the generic
// builder, not from this script.

const BOT = "Cognigy AI Agent";

/** Resolves the case and suggests the Outcome's disposition (an approved refund, or a remedy instead of one). */
const RESOLVED = { caseStatus: "Resolved", disposition: "Exception Approved" };

export const MARCUS_WEBB_SCRIPT = {
  version: 1,
  id: "marcus-webb-scenario",
  title: "Marcus Webb: refund above the bot's limit",
  summary: "A bot-handled voice call held for human review: a $200 refund the virtual agent can't approve.",
  // The page gives his call no number; this one is a placeholder.
  entity: { key: "marcus-webb-scenario", name: "Marcus Webb", caseId: "MW-DEMO-0001", directoryId: "marcus-webb-scenario", phone: "(503) 555-0142" },
  channel: "voice",
  skill: { name: "Returns", id: "returns" },
  participants: { bot: BOT },
  // In review the case reads Pending (waiting on a person); taking over makes it Open (the agent's).
  start: { answer: "delivered", review: true, ageMs: 180_000, caseStatus: "Pending" },
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
    // The bot's approval request, then the decision it asks the agent for.
    { id: "mw-approval", kind: "beat", beat: "approval", ref: "refund", at: 1400 },
    {
      id: "mw-decide",
      kind: "guide",
      at: 1400,
      nba: {
        type: "do",
        title: "Approve the refund",
        why: "The cracked ear cup was reported on delivery and the refund qualifies under the return policy; it only needs a person because it's above the AI agent's $100 limit.",
        action: "Returns the full $200.00 to Marcus's original payment method",
        branch: "approved",
        alt: [
          {
            type: "do",
            text: "Reject the refund",
            branch: "rejected",
            note: { label: "Reason", placeholder: "e.g. the damage report needs photos before this can be approved...", required: true },
          },
        ],
      },
    },
    // Taking over: the greeting is the agent's line, then Marcus answers and the AI suggests a remedy.
    { id: "mw-taken", kind: "event", anchor: "takeover", at: 0, text: "Agent Smith has taken over the conversation.", sets: { caseStatus: "Open" } },
    {
      id: "mw-greet",
      kind: "say",
      speaker: "agent",
      anchor: "takeover",
      at: 1000,
      text: "Hello, Mr. Webb. This is John. I noticed you are not happy about your headphones. Would you be interested in store credit or a discount?",
      nba: {
        type: "say",
        title: "Greet Marcus and offer a remedy",
        why: "He's been on hold for a while and is getting irate.",
        text: "Hello, Mr. Webb. This is John. I noticed you are not happy about your headphones. Would you be interested in store credit or a discount?",
      },
    },
    { id: "mw-reply", kind: "say", speaker: "customer", anchor: "takeover", at: 2000, text: "I'll take store credit." },
    {
      id: "mw-remedies",
      kind: "event",
      anchor: "takeover",
      at: 2500,
      by: BOT,
      text: "I have transferred the call. You are live with the customer. He is getting irate. Below are some suggested remedies for the situation.",
    },
    {
      id: "mw-remedy",
      kind: "guide",
      anchor: "takeover",
      at: 2500,
      nba: {
        type: "do",
        title: "Issue store credit",
        why: "Store credit toward a future purchase is the fastest way to make this right without a cash refund.",
        action: "Issues the credit to Marcus's account",
        branch: "remedy-store-credit",
        note: { label: "Credit amount", placeholder: "200", required: true, input: "storeCreditAmount", kind: "amount" },
        alt: [
          { type: "do", text: "Send a 10% discount code", branch: "remedy-discount-code", vars: { discountPercent: "10" } },
          { type: "do", text: "Send a 20% discount code", branch: "remedy-discount-code", vars: { discountPercent: "20" } },
          { type: "do", text: "Send a 30% discount code", branch: "remedy-discount-code", vars: { discountPercent: "30" } },
          {
            type: "do",
            text: "Something else",
            branch: "remedy-other",
            note: { label: "Instruction", placeholder: "Describe what you'd like to do instead...", required: true },
          },
        ],
      },
    },
  ],
  // Each decision's branch: the AI agent's work-item row (opens the decision's detail), the bot's and Marcus's
  // lines on the old card's timing, and event rows.
  branches: {
    approved: {
      label: "Refund approved: the bot tells Marcus",
      trigger: "action",
      steps: [
        { id: "mw-approved-row", kind: "beat", beat: "instruction", at: 0, text: "Refund approved", by: BOT, link: "action:approved" },
        {
          id: "mw-approved-1",
          kind: "say",
          speaker: "bot",
          at: 1500,
          text: "Great news — I've received approval from a supervisor. I'm processing your $200 refund now; you should see it back on your original payment method within 3-5 business days. Is there anything else I can help with?",
        },
        { id: "mw-thanks-1", kind: "say", speaker: "customer", at: 3000, text: "That's great, thank you so much for your help!" },
        { id: "mw-approved-disposition", kind: "event", at: 4500, by: BOT, text: 'Disposition updated to "Exception Approved"', sets: RESOLVED },
        {
          id: "mw-approved-done",
          kind: "event",
          at: 6000,
          by: BOT,
          text: "Excellent. I have approved the refund and responded to Marcus. I will let you know if there is any further issue with this contact.",
        },
      ],
    },
    rejected: {
      label: "Refund rejected: the bot offers alternatives and asks for a photo",
      trigger: "action",
      inputs: ["note"],
      steps: [
        { id: "mw-rejected-row", kind: "beat", beat: "instruction", at: 0, text: "Refund rejected", by: BOT, link: "action:rejected" },
        {
          id: "mw-rejected-1",
          kind: "say",
          speaker: "bot",
          at: 0,
          text: "Thanks for holding — I heard back from a supervisor, and unfortunately this refund wasn't approved as submitted. I'd like to offer you a replacement or store credit instead — which would you prefer?",
        },
        {
          id: "mw-rejection-reaction-1",
          kind: "say",
          speaker: "customer",
          at: 800,
          text: "Wait, seriously? I've been more than patient about this — I really don't understand why it's being denied.",
        },
        {
          id: "mw-photo-requested-1",
          kind: "say",
          speaker: "bot",
          at: 1500,
          text: "Understood — to help us evaluate this further, could you send a photo of the damaged ear cup?",
        },
        { id: "mw-photo-event", kind: "event", at: 3000, by: BOT, text: "Refund rejected. Requested customer provide visual proof" },
        {
          id: "mw-photo-reaction-1",
          kind: "say",
          speaker: "customer",
          at: 3000,
          text: "Are you kidding me? I already explained what happened. Fine, I'll send a photo, but this is getting frustrating.",
        },
        {
          id: "mw-rejected-done",
          kind: "event",
          at: 4500,
          by: BOT,
          text: "I have requested the customer provide a photo of the damaged item. This seems to have upset them. Their sentiment is detected at slightly negative.",
        },
      ],
    },
    // The photo arriving and the decision after it. Nothing starts this today: the old card had it switched off
    // (SHOW_REJECT_PROCESSING_STEPS), and the port keeps it as data.
    "photo-follow-up": {
      label: "Marcus sends the photo",
      trigger: "action",
      steps: [
        { id: "mw-photo-arrived", kind: "event", at: 0, by: BOT, text: "The customer provided the attached photo." },
        {
          id: "mw-photo-decide",
          kind: "guide",
          at: 0,
          nba: {
            type: "do",
            title: "Approve the refund",
            why: "The photo shows the cracked ear cup he reported.",
            action: "Returns the full $200.00 to Marcus's original payment method",
            branch: "approved",
            alt: [
              { type: "do", text: "Reject and give another reason", branch: "rejected-again", note: { label: "Reason", placeholder: "Why can't it be approved?", required: true } },
              { type: "do", text: "Flag the account for review", branch: "flagged", note: { label: "Instruction", placeholder: "What should the AI agent do?", required: true } },
            ],
          },
        },
      ],
    },
    "rejected-again": {
      label: "Refund rejected for another reason",
      trigger: "action",
      inputs: ["note"],
      steps: [{ id: "mw-rejected-again-row", kind: "beat", beat: "instruction", at: 0, text: "Refund rejected", by: BOT, link: "action:rejected-again" }],
    },
    flagged: {
      label: "The account is flagged for review and the case escalated",
      trigger: "action",
      inputs: ["note"],
      steps: [
        { id: "mw-flagged-row", kind: "beat", beat: "instruction", at: 0, text: "Instruction sent", by: BOT, link: "action:flagged" },
        { id: "mw-flagged-escalated", kind: "event", at: 3000, by: BOT, text: 'Status updated to "Escalated"', sets: { caseStatus: "Escalated" } },
      ],
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
        { id: "mw-remedy-store-credit-2", kind: "event", at: 0, text: "Store credit issued · ${storeCreditAmount} store credit", sets: RESOLVED },
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
        { id: "mw-remedy-discount-code-2", kind: "event", at: 0, text: "Discount code sent · {discountPercent}% off discount code", sets: RESOLVED },
      ],
    },
    "remedy-other": {
      label: "The agent does something else",
      trigger: "action",
      inputs: ["note"],
      steps: [
        { id: "mw-remedy-other-1", kind: "say", speaker: "agent", at: 0, text: "Understood — I'll go ahead and take care of that: {note}" },
        { id: "mw-remedy-other-2", kind: "event", at: 0, text: "Instruction sent · {note}", sets: RESOLVED },
      ],
    },
  },
  content: {
    panelKeys: [
      "order",
      "memory:order-placed",
      "memory:damage-reported",
      "memory:refund-escalated",
      "copilot:summary",
      "copilot:purchases",
      "copilot:ai-tried",
      "action:approved",
      "action:rejected",
      "action:rejected-again",
      "action:flagged",
    ],
    approvals: {
      refund: {
        title: "Approval request · Cognigy AI Agent",
        headline: "Marcus Webb is requesting a $200 refund",
        description:
          "Marcus placed an order for noise-cancelling headphones last Tuesday and reported the item arrived with a cracked ear cup. I've confirmed the $200 refund qualifies, but it exceeds our $100 auto-approval limit, so I've placed Marcus on hold pending your sign-off.",
        checklist: [
          { label: "Order verified", link: "memory:order-placed", detail: "Noise-cancelling headphones, order #48213, placed last Tuesday", status: "done" },
          { label: "Damage reported", link: "memory:damage-reported", detail: "Cracked ear cup reported by the customer", status: "done" },
          { label: "Refund eligibility", link: "memory:refund-escalated", detail: "$200 refund qualifies under the return policy", status: "done" },
          { label: "Refund approval", link: "memory:refund-escalated", detail: "Exceeds the $100 auto-approval limit", status: "attention", badge: "Needs a person" },
        ],
        memoryTitle: "Experience Memory",
        memory: ["Marcus is on hold while this is reviewed", "Refund exceeds the $100 auto-approval limit", "Cracked ear cup reported on delivery"],
        sentimentLabel: "Customer sentiment",
        sentimentValue: "Concerned",
        sentimentLevel: 3,
      },
    },
    copilot: {
      suggestions: ["Summarize this call", "Show purchase history", "What did the AI agent try?"],
      links: {
        "Summarize this call": "copilot:summary",
        "Show purchase history": "copilot:purchases",
        "What did the AI agent try?": "copilot:ai-tried",
      },
    },
  },
} satisfies ScenarioScript;
