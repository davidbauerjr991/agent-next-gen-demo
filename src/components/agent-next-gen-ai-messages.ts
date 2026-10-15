import type { TranscriptMessage } from "@/components/agent-next-gen-transcript";

/** True for the AI *cards* in a conversation: instruction rows (Copilot
 *  results), approval requests and wrap-up cards, the annotation-carrying
 *  messages. Settings → AI display "In the Contact Details panel" moves
 *  these out of the transcript into the panel. Event rows ("Chat started",
 *  "Payment link sent", …) and bot or agent lines are the conversation
 *  record and always stay in the transcript, in both modes. */
export const isAiActionMessage = (m: TranscriptMessage) => !!(m.instruction || m.wrapUp || m.summary);
