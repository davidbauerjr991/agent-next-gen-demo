// Copilot results (P-LAYOUT-F1 F): what an Ask Copilot question or chip answers, and how the answer shows. A plain
// answer is an event line in the conversation ("time · Copilot · the question", then the text): not clickable, not
// collapsible, not an artifact. Anything more is a card: the instruction row, the result card, the slide-over on a
// row click, opened on its own only when the result carries an artifact. `resultPresentation` is the only decider.
// The result is the AssistProvider's answer (P-LAYOUT-F2 5b): a question with no registered result is asked of the
// provider (`useCopilotAsk`), and its answer is kept for that row alone (by the row's link), so its slide-over finds
// it again; the question registry holds only tests' and scripted cases' results.
import type { AssistAnswer } from "@/providers";

export type CopilotResult = AssistAnswer;

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
/** The provider's answers, by the row they answer (its link, unique per ask): the row's slide-over reads its own. */
let answers = new Map<string, CopilotResult>();

const keyOf = (question: string) => question.trim().toLowerCase();

/** A result for one question or chip text, on every contact (a test's or a scripted case's). */
export function registerCopilotResult(question: string, result: CopilotResult): void {
  registered.set(keyOf(question), result);
}

export function resetCopilotResults(): void {
  registered = new Map();
  answers = new Map();
}

/** Keeps the provider's answer for one row (`useCopilotAsk`), so its slide-over shows it again. */
export function rememberCopilotAnswer(rowLink: string, answer: CopilotResult): void {
  answers.set(rowLink, answer);
}

/** A row's own answer, if the provider answered it. */
export function copilotAnswerForRow(rowLink: string): CopilotResult | undefined {
  return answers.get(rowLink);
}

// Dev-only handle for Playwright (e2e's `registerCardResult`), as ProviderRoot's `__providers`; app code never reads
// it.
if (import.meta.env.DEV && typeof window !== "undefined") window.__copilotResults = { register: registerCopilotResult };

/** The registered result for a question, else `fallback`'s (a kind item's scripted answer); undefined with neither
 *  (the provider hasn't answered it yet). */
export function copilotResultFor(question: string, fallback: (question: string) => CopilotResult): CopilotResult;
export function copilotResultFor(question: string): CopilotResult | undefined;
export function copilotResultFor(question: string, fallback?: (question: string) => CopilotResult): CopilotResult | undefined {
  return registered.get(keyOf(question)) ?? fallback?.(question);
}
