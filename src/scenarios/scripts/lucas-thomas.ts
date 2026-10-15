import type { ScenarioScript } from "../scenario-script";

// Lucas Thomas: a webchat (CASE-30418, from the Agentic Workspace demo) a
// Checkout AI agent has handled so far. Card payments are failing during
// INC-2207; the bot asks a person to approve an exception. The setup (6
// lines) is already on screen at launch, the rest plays live, and the agent's
// decisions start the branches below. Ported from
// agent-next-gen-lucas-thomas-scenario.ts (and the takeover handoff lines in
// AgentWorkspaceAdvancedPage.tsx); the page still reads those until P0.5c.
// Display times ("2:05 PM") are dropped: the engine's clock supplies them.
export const LUCAS_THOMAS_SCRIPT = {
  version: 1,
  id: "lucas-thomas",
  title: "Lucas Thomas: declined launch order",
  summary:
    "A bot-handled webchat about a declined Aurora X2 launch order. The agent approves or declines an exception; a follow-up about shipping leads to a second approval and a wrap-up.",
  // The case gives him no number; this placeholder is the one the page's
  // "Call now" dials, and it lets the script launch as voice.
  entity: { key: "lucas-thomas", name: "Lucas Thomas", caseId: "CASE-30418", phone: "(415) 555-0142" },
  channel: "chat",
  skill: { name: "AI Review", id: "ai-review" },
  participants: { bot: "AI agent · Checkout" },
  start: { answer: "delivered", review: true, ageMs: 251_000 },
  launch: { hotkey: "A" },
  steps: [
    // Already on screen at launch.
    { id: "lt-chat-started", kind: "event", onlyOn: ["chat"], at: -251_000, text: "Chat started" },
    { id: "lt-1", kind: "say", speaker: "customer", at: -250_000, text: "My card got declined on the Aurora X2 launch order. Is the price gone?" },
    {
      id: "lt-2",
      kind: "say",
      speaker: "bot",
      at: -246_000,
      text: "I found order NR-11056. Your card was declined, so it wasn't placed. I've held the launch price of $189.00 and your unit for 24 hours.",
    },
    { id: "lt-2-event", kind: "event", at: -245_000, text: "Launch price held for 24 h" },
    { id: "lt-3", kind: "say", speaker: "bot", at: -190_000, text: "Here's a secure link to pay another way." },
    { id: "lt-3-event", kind: "event", at: -189_000, text: "Payment link sent" },
    // Plays live after launch.
    { id: "lt-4-typing", kind: "typing", speaker: "customer", at: 1500, durationMs: 3000 },
    { id: "lt-4", kind: "say", speaker: "customer", at: 4500, text: "That failed too. Can someone just place it for me?" },
    { id: "lt-5-typing", kind: "typing", speaker: "bot", at: 5200, durationMs: 2800 },
    {
      id: "lt-5",
      kind: "say",
      speaker: "bot",
      at: 8000,
      text: "I'm sorry, Lucas. I'm aware of an issue with checkout right now. Card payments are failing for some customers and our payments team is working on it.",
    },
    { id: "lt-6-typing", kind: "typing", speaker: "bot", at: 8600, durationMs: 2900 },
    {
      id: "lt-6",
      kind: "say",
      speaker: "bot",
      at: 11_500,
      text: "Placing it another way needs a person's approval, so I'm asking a payments specialist now. They'll see everything we've tried.",
    },
    { id: "lt-6-event", kind: "event", at: 12_300, text: "Approval requested" },
    { id: "lt-6-summary", kind: "beat", beat: "approval", ref: "initial", at: 13_300 },
    // The agent takes the chat over: the bot hands off and Lucas acknowledges.
    { id: "lt-warm-handoff-typing", kind: "typing", speaker: "bot", anchor: "takeover", at: 500, durationMs: 1800 },
    {
      id: "lt-warm-handoff",
      kind: "say",
      speaker: "bot",
      anchor: "takeover",
      at: 2300,
      text: "Thanks for your patience, Lucas. I'm going to transfer you to John Smith, one of our team members, who will take it from here. I've shared everything we've covered so he can help with your Aurora X2 order right away.",
    },
    { id: "lt-handoff-reply-typing", kind: "typing", speaker: "customer", anchor: "takeover", at: 3300, durationMs: 2000 },
    { id: "lt-handoff-reply", kind: "say", speaker: "customer", anchor: "takeover", at: 5300, text: "Ok, sounds good" },
  ],
  branches: {
    accept: {
      label: "Approve the exception",
      steps: [
        { id: "accept-1", kind: "beat", beat: "instruction", at: 150, text: "Authorize and place order NR-11056" },
        { id: "accept-2", kind: "event", at: 900, text: "Exception approved by John Smith" },
        { id: "accept-3", kind: "event", at: 2600, text: "Order NR-11056 placed at the held launch price" },
        { id: "accept-4", kind: "event", at: 3600, text: 'Disposition updated to "Exception Approved"' },
        { id: "accept-5-typing", kind: "typing", speaker: "bot", at: 4200, durationMs: 2600 },
        {
          id: "accept-5",
          kind: "say",
          speaker: "bot",
          at: 6800,
          text: "Good news, Lucas — your order NR-11056 has been placed at the launch price of $189.00. You'll receive a confirmation email shortly. Thanks for your patience!",
        },
        { id: "accept-6-typing", kind: "typing", speaker: "customer", at: 8200, durationMs: 2600 },
        { id: "accept-6", kind: "say", speaker: "customer", at: 10_800, text: "Thank you so much — really appreciate the quick help!" },
        // Lucas follows up, so the chat stays open for the agent to answer.
        { id: "accept-7-typing", kind: "typing", speaker: "customer", at: 12_400, durationMs: 2800 },
        { id: "accept-7", kind: "say", speaker: "customer", at: 15_200, text: "Will it still ship today? It's a birthday present for Friday." },
        { id: "accept-8-typing", kind: "typing", speaker: "bot", at: 16_200, durationMs: 2400 },
        { id: "accept-8", kind: "say", speaker: "bot", at: 18_600, text: "I understand your concern. Let me check that for you." },
        // The bot checks, logging it as a row that opens the shipping details.
        {
          id: "accept-9",
          kind: "beat",
          beat: "instruction",
          at: 19_600,
          text: "Checking order processing, shipping and arrival",
          by: "Checkout AI Agent",
          link: "shipping-check",
        },
        { id: "accept-10-typing", kind: "typing", speaker: "bot", at: 21_800, durationMs: 3000 },
        {
          id: "accept-10",
          kind: "say",
          speaker: "bot",
          at: 24_800,
          text: "I checked order NR-11056: it has been processed and will ship out today with standard shipping. Unfortunately, standard delivery is estimated to arrive on Monday, so it won't make it by Friday. I can upgrade you to priority shipping for an additional $15, which would get it to you on Thursday. Would you like me to add it?",
        },
        { id: "accept-11-typing", kind: "typing", speaker: "customer", at: 27_200, durationMs: 3200 },
        {
          id: "accept-11",
          kind: "say",
          speaker: "customer",
          at: 30_400,
          text: "Honestly, this is really frustrating. It was your order system that wasn't working properly, so I think the company should pay for the priority shipping, not me.",
        },
        { id: "accept-12-typing", kind: "typing", speaker: "bot", at: 31_400, durationMs: 3200 },
        {
          id: "accept-12",
          kind: "say",
          speaker: "bot",
          at: 34_600,
          text: "I completely understand, Lucas, and I'm sorry for the trouble. I'm not able to authorize that override myself, but I'll check with my human supervisor to see if they can approve covering the priority shipping. Please hold on for just a moment.",
        },
        // A second approval request: waive the $15.00 priority shipping.
        { id: "accept-13", kind: "beat", beat: "approval", ref: "shipping", at: 37_000 },
      ],
    },
    "ship-accept": {
      label: "Approve the shipping override",
      steps: [
        { id: "ship-accept-1", kind: "beat", beat: "instruction", at: 150, text: "Approve free priority shipping for NR-11056" },
        { id: "ship-accept-2", kind: "event", at: 900, text: "Override approved by John Smith" },
        { id: "ship-accept-3", kind: "event", at: 2400, text: "Priority shipping added to NR-11056 · $15.00 waived" },
        { id: "ship-accept-4-typing", kind: "typing", speaker: "bot", at: 3000, durationMs: 3000 },
        {
          id: "ship-accept-4",
          kind: "say",
          speaker: "bot",
          at: 6000,
          text: "Good news, Lucas — my supervisor approved it. I've upgraded order NR-11056 to priority shipping at no cost to you. It ships today and will arrive on Thursday, in time for the birthday.",
        },
        { id: "ship-accept-5-typing", kind: "typing", speaker: "customer", at: 7400, durationMs: 2600 },
        { id: "ship-accept-5", kind: "say", speaker: "customer", at: 10_000, text: "That's wonderful, thank you so much for sorting this out!" },
        // The chat has ended: a wrap-up card; completing it saves the outcome.
        { id: "ship-accept-6", kind: "beat", beat: "wrap-up", ref: "main", at: 12_000, unlessTakenOver: true },
      ],
    },
    "ship-wrapup": {
      label: "Complete the wrap-up",
      steps: [
        { id: "ship-wrapup-1", kind: "event", at: 600, text: 'Outcome saved · Disposition "Checkout · payment incident · resolved"' },
        { id: "ship-wrapup-2", kind: "event", at: 2000, text: "Chat closed and unassigned from John Smith" },
        { id: "ship-wrapup-3", kind: "beat", beat: "close", at: 2100 },
        // Dismissed on its own only if the agent never took over.
        { id: "ship-wrapup-4", kind: "beat", beat: "dismiss", at: 6000, unlessTakenOver: true },
      ],
    },
    "ship-decline": {
      label: "Decline the shipping override",
      inputs: ["note"],
      steps: [
        { id: "ship-decline-1", kind: "beat", beat: "instruction", at: 150, text: "Declined: {note}" },
        { id: "ship-decline-2", kind: "event", at: 900, text: "Override declined by John Smith: {note}" },
        { id: "ship-decline-3-typing", kind: "typing", speaker: "bot", at: 1500, durationMs: 3000 },
        {
          id: "ship-decline-3",
          kind: "say",
          speaker: "bot",
          at: 4500,
          text: "I'm sorry, Lucas — my supervisor wasn't able to approve waiving the priority shipping fee. Your order ships today with standard shipping, or I can add priority shipping for $15.00 if you'd like it by Thursday.",
        },
      ],
    },
    "ship-other": {
      label: "Something else (shipping)",
      inputs: ["note"],
      steps: [
        { id: "ship-other-1", kind: "beat", beat: "instruction", at: 150, text: "{note}" },
        { id: "ship-other-2", kind: "event", at: 900, text: "Instruction sent to the AI agent: {note}" },
        { id: "ship-other-3-typing", kind: "typing", speaker: "bot", at: 1500, durationMs: 3000, onlyIf: "note-addresses-customer" },
        {
          id: "ship-other-3",
          onlyIf: "note-addresses-customer",
          kind: "say",
          speaker: "bot",
          at: 4500,
          text: "Thanks for your patience, Lucas — I'm following my supervisor's instructions and will update you on the shipping in just a moment.",
        },
      ],
    },
    decline: {
      label: "Decline the exception",
      inputs: ["note"],
      steps: [
        { id: "decline-1", kind: "beat", beat: "instruction", at: 150, text: "Declined: {note}" },
        { id: "decline-2", kind: "event", at: 900, text: "Exception declined by John Smith: {note}" },
        { id: "decline-3", kind: "event", at: 2200, text: 'Disposition updated to "Exception Declined"' },
        { id: "decline-4-typing", kind: "typing", speaker: "bot", at: 2800, durationMs: 2600 },
        {
          id: "decline-4",
          kind: "say",
          speaker: "bot",
          at: 5400,
          text: "I'm sorry, Lucas — we're unable to place order NR-11056 for you right now. Your launch price stays held for 24 hours, so you can complete the purchase once checkout is back to normal.",
        },
        // Lucas gets irate and demands a call; an escalation card asks the agent how to respond.
        { id: "decline-5-typing", kind: "typing", speaker: "customer", at: 7000, durationMs: 2400 },
        {
          id: "decline-5",
          kind: "say",
          speaker: "customer",
          at: 9400,
          text: "This is unacceptable. I've been trying to buy this for hours. I want someone to call me immediately, right now!",
        },
        { id: "decline-6", kind: "beat", beat: "approval", ref: "upset", at: 11_800 },
      ],
    },
    "upset-call": {
      label: "Call Lucas now",
      steps: [
        { id: "upset-call-1", kind: "event", at: 150, text: "John Smith is calling Lucas Thomas" },
        { id: "upset-call-2-typing", kind: "typing", speaker: "bot", at: 1200, durationMs: 1400 },
        {
          id: "upset-call-2",
          kind: "say",
          speaker: "bot",
          at: 2600,
          text: "I'm sorry for the frustration, Lucas. John Smith is calling you right now, so please keep your phone nearby.",
        },
        { id: "upset-call-3", kind: "event", at: 4200, text: "Call connected · Lucas answered" },
      ],
    },
    "upset-transfer": {
      label: "Transfer Lucas",
      steps: [
        { id: "upset-transfer-1", kind: "beat", beat: "instruction", at: 150, text: "Transfer Lucas to a specialist" },
        { id: "upset-transfer-2", kind: "event", at: 900, text: "Transferring Lucas to a specialist" },
        { id: "upset-transfer-3-typing", kind: "typing", speaker: "bot", at: 1500, durationMs: 2800 },
        {
          id: "upset-transfer-3",
          kind: "say",
          speaker: "bot",
          at: 4300,
          text: "I'm sorry for the frustration, Lucas. I'm transferring you to a specialist now who can help you right away.",
        },
      ],
    },
    "upset-other": {
      label: "Something else (escalation)",
      inputs: ["note"],
      steps: [
        { id: "upset-other-1", kind: "beat", beat: "instruction", at: 150, text: "{note}" },
        { id: "upset-other-2", kind: "event", at: 900, text: "Instruction sent to the AI agent: {note}" },
        { id: "upset-other-3-typing", kind: "typing", speaker: "bot", at: 1200, durationMs: 2800, onlyIf: "note-addresses-customer" },
        {
          id: "upset-other-3",
          onlyIf: "note-addresses-customer",
          kind: "say",
          speaker: "bot",
          at: 4000,
          text: "Thanks for your patience, Lucas — I'm working on this with a specialist and will update you here shortly.",
        },
      ],
    },
    other: {
      label: "Something else",
      inputs: ["note"],
      steps: [
        { id: "other-1", kind: "beat", beat: "instruction", at: 150, text: "{note}" },
        { id: "other-2", kind: "event", at: 900, text: "Instruction sent to the AI agent: {note}" },
        { id: "other-3-typing", kind: "typing", speaker: "bot", at: 1200, durationMs: 2800, onlyIf: "note-addresses-customer" },
        {
          id: "other-3",
          onlyIf: "note-addresses-customer",
          kind: "say",
          speaker: "bot",
          at: 4000,
          text: "Thanks for your patience, Lucas — I'm working on this with a specialist and will update you here shortly.",
        },
      ],
    },
  },
  content: {
    panelKeys: [
      "shipping-check",
      "purchase-history",
      "fraud-screening",
      "payment-preferences",
      "ai-attempts",
      "article-pay-3-2",
      "payments",
      "memory:card-declined",
      "memory:order",
      "memory:link-requested",
      "memory:payment-review",
    ],
    caseContext: {
      priority: "P1",
      status: "Queued",
      incident: "Payment review · INC-2207 · stage 3 of 5",
      pinned: ["Escalation · Authorization limit · alternate payment", "Sentiment · Frustrated"],
      profile: "Insider since 2023 · 14 orders · prefers text",
      memory: [
        "Card declined at checkout · 2:01 PM",
        "Pay-another-way link requested · 2:03 PM",
        "Payment review · INC-2207 · stage 3 of 5",
        "Chat started · 2:05 PM",
      ],
    },
    copilot: {
      suggestions: ["Show purchase history", "Payment preferences", "What did the AI agent try?"],
      links: {
        "Show shipping details": "shipping-check",
        "Show purchase history": "purchase-history",
        "Check fraud screening results": "fraud-screening",
        "Payment preferences": "payment-preferences",
        "What did the AI agent try?": "ai-attempts",
      },
      replacements: { "Show purchase history": "Check fraud screening results" },
    },
    approvals: {
      initial: {
        title: "Approval request · Checkout AI Agent",
        headline:
          "Checkout AI Agent reached its authorization limit and is requesting an exception: place order NR-11056 with another payment method at the held launch price.",
        description: "Lucas tried to buy the Aurora X2 launch edition at $189.00. Checkout failed twice during a payment incident.",
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
      shipping: {
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
      },
      upset: {
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
      },
    },
    wrapUps: {
      main: {
        title: "Wrap up · Checkout AI Agent",
        summary:
          "Aurora X2 launch order failed twice during INC-2207. Approved the exception and placed it with PayPal at the held $189.00 price. Lucas then asked about shipping for a Friday birthday gift: standard would arrive Monday, so priority shipping (arrives Thursday) was offered at $15.00. He felt the company should cover it; the AI agent escalated, John Smith approved waiving the fee, and the upgrade was added at no cost. He thanked us and is satisfied.",
        disposition: "Disposition · Checkout · payment incident · resolved",
        buttonLabel: "Complete wrap-up",
        completeBranch: "ship-wrapup",
      },
    },
  },
} satisfies ScenarioScript;
