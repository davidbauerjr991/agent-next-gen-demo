// For tests whose way into the slide-over is an Ask Copilot question (P-LAYOUT-F1 F): a plain answer is an event line
// now, with no row or slide-over. This registers a card-presenting result for the question the test asks: the sim's
// answer to the question (src/adapters/sim/sim-copilot-answers.ts, P-LAYOUT-F2 5b) with an artifact, so it opens on its
// own once Copilot finishes and its row reopens it. e2e's `registerCardResult` builds the same card through the
// dev-only window handles. The workspace harness clears the registry before every test.
import { simCopilotAnswer } from "@/adapters/sim/sim-copilot-answers";
import { registerCopilotResult } from "@/contact-handling/copilot-results";

export function registerCardResult(question: string): void {
  registerCopilotResult(question, { ...simCopilotAnswer(question), artifact: { kind: "panel" } });
}
