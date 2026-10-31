import type { TranscriptMessage } from "@/components/transcript/InteractionTranscript";

/** A plain Copilot answer's event line (P-LAYOUT-F1 F: "time · Copilot · the question"): an answer to the agent, not
 *  the conversation record, so it goes where the AI actions go. */
export const isCopilotLine = (m: TranscriptMessage) => !!(m.event && m.eventContext);

/** True for the AI *cards* in a conversation: instruction rows (Copilot
 *  results), approval requests and wrap-up cards, the annotation-carrying
 *  messages, and plain Copilot answers' lines. Settings → AI display "In the
 *  Contact Details panel" moves these out of the transcript into the panel.
 *  Other event rows ("Chat started", "Payment link sent", …) and bot or agent
 *  lines are the conversation record and always stay in the transcript, in
 *  both modes. */
export const isAiActionMessage = (m: TranscriptMessage) =>
  !!(m.instruction || m.wrapUp || m.summary || m.saveAddress || m.nbaOutcome || m.nba) || isCopilotLine(m);
