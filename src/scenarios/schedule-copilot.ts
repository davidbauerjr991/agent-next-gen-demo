// Ask Copilot on a kind cell (P-HOME-1f): the suggestion chips and scripted
// answers for a schedule item, keyed on its seed id (src/adapters/sim/
// sim-schedule-seeds.ts), as the scenario scripts carry a conversation's.
// A seed without a script gets its kind's; a question without a scripted
// answer gets a generic one scoped to the item. Scenario content is data,
// not wrapped in t().
import type { AssignmentKind } from "@/domain";
import type { ScheduleItem } from "@/providers";

export interface CopilotAnswer {
  summary: string;
  points: readonly string[];
}

export interface ScheduleCopilotScript {
  suggestions: readonly string[];
  /** Keyed by suggestion (or a typed question, lowercased). */
  answers: Readonly<Record<string, CopilotAnswer>>;
}

const SCRIPTS: Readonly<Record<string, ScheduleCopilotScript>> = {
  "agent-cb-priya": {
    suggestions: ["Where is refund RF-20451?", "What did Priya say last time?", "Draft my opening line"],
    answers: {
      "Where is refund RF-20451?": {
        summary: "RF-20451 was approved on the 22nd and is held at the card issuer.",
        points: ["Issued to the Visa ending 4417.", "Banks post refunds in 5–7 business days; today is day 4.", "No second refund is needed."],
      },
      "What did Priya say last time?": {
        summary: "Priya chatted yesterday and asked to be called back about the refund.",
        points: ["She was polite but had been waiting a week.", "She prefers a call after 10 AM."],
      },
      "Draft my opening line": {
        summary: "A warm opening for the callback.",
        points: ["“Hi Priya, it's John from Returns, calling back about your refund RF-20451 as promised.”"],
      },
    },
  },
  "agent-tk-4821": {
    suggestions: ["What's blocking this ticket?", "Summarize the customer's history", "Draft the resolution note"],
    answers: {
      "What's blocking this ticket?": {
        summary: "Credit RF-20452 is waiting on a Billing release.",
        points: ["Billing owns the release; the request was sent this morning.", "The customer hasn't been told of the delay yet."],
      },
      "Summarize the customer's history": {
        summary: "Priya Shah: three contacts in the last month, all about the renewal refund.",
        points: ["Renewal charged twice on the 1st.", "One refund posted; the credit is the second."],
      },
      "Draft the resolution note": {
        summary: "A note for the ticket once Billing releases the credit.",
        points: ["“Credit RF-20452 released by Billing; customer informed by phone. Closing.”"],
      },
    },
  },
  "agent-mt-standup": {
    suggestions: ["What should I raise?", "Summarize yesterday's queue"],
    answers: {
      "What should I raise?": {
        summary: "Two things from your day worth raising.",
        points: ["Refund RF-20451's delay at the issuer.", "Ticket #4821 waiting on Billing."],
      },
      "Summarize yesterday's queue": {
        summary: "Yesterday the returns queue ran under target.",
        points: ["Average wait 1:42, against a 2:00 target.", "Two escalations, both resolved."],
      },
    },
  },
  "agent-tr-ret13": {
    suggestions: ["What changed in RET-1.3?", "Quiz me on it"],
    answers: {
      "What changed in RET-1.3?": {
        summary: "RET-1.3 shortens the refund window and adds store credit.",
        points: ["Refunds within 30 days, down from 45.", "Store credit offered after 30 days."],
      },
    },
  },
};

const BY_KIND: Readonly<Partial<Record<AssignmentKind, ScheduleCopilotScript>>> = {
  callback: { suggestions: ["Why did they ask for a callback?", "Draft my opening line"], answers: {} },
  task: { suggestions: ["What's blocking this?", "Draft the resolution note"], answers: {} },
  meeting: { suggestions: ["What should I raise?", "Summarize the agenda"], answers: {} },
  training: { suggestions: ["What does this module cover?"], answers: {} },
  coaching: { suggestions: ["What should we focus on?"], answers: {} },
  evaluation: { suggestions: ["Where did the AI pre-score land?"], answers: {} },
  "campaign-block": { suggestions: ["Who should I call first?"], answers: {} },
};

/** The item's script: its seed's, else its kind's. */
export function scheduleCopilotFor(item: ScheduleItem): ScheduleCopilotScript {
  return SCRIPTS[item.id] ?? BY_KIND[item.kind] ?? { suggestions: [], answers: {} };
}

/** The answer to `question` on `item`: the script's, else one scoped to the item. */
export function scheduleCopilotAnswer(item: ScheduleItem, question: string): CopilotAnswer {
  const script = scheduleCopilotFor(item);
  const scripted = script.answers[question] ?? Object.entries(script.answers).find(([q]) => q.toLowerCase() === question.trim().toLowerCase())?.[1];
  return scripted ?? { summary: `Here is what Copilot found for ${item.title}.`, points: [item.subtitle, `From ${item.sourceLabel}.`] };
}
