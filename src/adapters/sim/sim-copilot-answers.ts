// The simulation's Copilot answers (P-LAYOUT-F2 5b; moved from src/contact-handling/copilot-results.ts): what the sim
// assist provider answers to an "ask" trigger on a contact with no script, shaped like the scripted cases' results.
// Every one is a plain answer (one paragraph, at most three bullets: an inline line). A real AssistProvider answers
// from the conversation (P4.8).
import type { AssistAnswer } from "@/providers";

/** The placeholder answer for a question. */
export function simCopilotAnswer(question: string): AssistAnswer {
  const q = question.toLowerCase();
  if (q.includes("draft") || q.includes("suggest a reply")) {
    return {
      summary: "Here is a reply Copilot drafted from the conversation so far.",
      points: ["Acknowledges the customer's request.", "Confirms the next step and when they'll hear back.", "Review it before sending."],
    };
  }
  if (q.includes("next step")) {
    return {
      summary: "Suggested next steps for this contact.",
      points: ["Confirm the customer's details.", "Resolve the open request or set a follow-up.", "Add a disposition when you wrap up."],
    };
  }
  if (q.includes("history")) {
    return {
      summary: "The customer's recent contacts, from Contact History.",
      points: ["Open Contact History for the full list.", "Prior outcomes and notes appear in Contact Details."],
    };
  }
  return {
    summary: "Here is what Copilot found in this contact.",
    points: ["The customer's request and its current status.", "Anything still open before you wrap up."],
  };
}

// Dev-only handle for Playwright (e2e's `registerCardResult`, which builds a card from the same answer), beside the
// app's registry handle (copilot-results.ts); app code never reads it.
if (import.meta.env.DEV && typeof window !== "undefined") window.__copilotAnswers = { placeholder: simCopilotAnswer };
