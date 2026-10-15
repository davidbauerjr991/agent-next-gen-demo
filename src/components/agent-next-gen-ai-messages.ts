import type { TranscriptMessage } from "@/components/agent-next-gen-transcript";

/** True for messages that are AI content (interstitial, approval summary,
 *  wrap-up, event line) rather than conversation. Settings → AI display "In
 *  the Contact Details panel" moves these out of the transcript. */
export const isAiActionMessage = (m: TranscriptMessage) => !!(m.instruction || m.wrapUp || m.summary || m.event);
