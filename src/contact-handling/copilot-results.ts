// Copilot results (P-LAYOUT-F1 F): what an Ask Copilot question or chip answers, and how the answer shows. A plain
// answer is an event line in the conversation ("time · Copilot · the question", then the text): not clickable, not
// collapsible, not an artifact. Anything more is a card: the instruction row, the result card, the slide-over on a
// row click, opened on its own only when the result carries an artifact. `resultPresentation` is the only decider.
// There's no AssistProvider answer yet (P4.8): a question with no registered result gets the placeholder for it.

export interface CopilotResult {
  /** The answer's text; paragraphs separated by a blank line. */
  summary: string;
  points: readonly string[];
  /** Section headings, for an answer long enough to need them. */
  headings?: readonly string[];
  /** Things the agent can do with the answer (insert a draft, open a record). */
  actions?: readonly { label: string }[];
  /** The result is a panel of its own (a scripted case's result, a lookup): it's added to the Artifacts. */
  artifact?: { kind: "panel" };
}

/** How many bullets a plain line may carry. */
const LINE_MAX_POINTS = 3;

/** "line" when the result has no actions, no artifact and no headings, and is short: one paragraph, at most three
 *  bullets. Otherwise "card". */
export function resultPresentation(result: CopilotResult): "line" | "card" {
  if (result.actions?.length || result.artifact || result.headings?.length) return "card";
  const paragraphs = result.summary.split(/\n\s*\n/).filter((p) => p.trim()).length;
  return paragraphs <= 1 && result.points.length <= LINE_MAX_POINTS ? "line" : "card";
}

let registered = new Map<string, CopilotResult>();

const keyOf = (question: string) => question.trim().toLowerCase();

/** A result for one question or chip text, ahead of the placeholder. */
export function registerCopilotResult(question: string, result: CopilotResult): void {
  registered.set(keyOf(question), result);
}

export function resetCopilotResults(): void {
  registered = new Map();
}

// Dev-only handle for Playwright (e2e's `registerCardResult`, which builds its card from the same placeholder), as
// ProviderRoot's `__providers`; app code never reads it.
if (import.meta.env.DEV && typeof window !== "undefined") window.__copilotResults = { register: registerCopilotResult, placeholder: placeholderCopilotResult };

/** The placeholder for a question on a contact with no script, shaped like the scripted cases' results. */
export function placeholderCopilotResult(question: string): CopilotResult {
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

/** The result for a question: a registered one, else `fallback`'s (a kind item's scripted answer), else the
 *  placeholder for a contact with no script. */
export function copilotResultFor(question: string, fallback: (question: string) => CopilotResult = placeholderCopilotResult): CopilotResult {
  return registered.get(keyOf(question)) ?? fallback(question);
}
