// For tests whose way into the slide-over is an Ask Copilot question (P-LAYOUT-F1 F): a plain answer is an event line
// now, with no row or slide-over. This registers a card-presenting result (one with an artifact, so it opens on its own
// once Copilot finishes, and its row reopens it) for the question the test asks. The workspace harness clears the
// registry before every test.
import { registerCopilotResult } from "@/contact-handling/copilot-results";

export function registerCardResult(question: string): void {
  registerCopilotResult(question, {
    summary: "Here is what Copilot found in this contact.",
    points: ["The customer's request and its current status.", "Anything still open before you wrap up."],
    artifact: { kind: "panel" },
  });
}
