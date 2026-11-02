// The AI cards in a conversation, from the AI card kinds registry (`contact-handling/ai-card-kinds.ts`, P-LAYOUT-F4 8):
// instruction rows (Copilot results and interstitials), approval requests, wrap-up cards, the annotation-carrying
// messages, and plain Copilot answers' lines. Settings → AI display "In the Contact Details panel" moves the on-demand
// kinds out of the transcript into the panel; the pushed ones stay in it. Other event rows ("Chat started", "Payment
// link sent", …) and bot or agent lines are the conversation record and always stay in the transcript, in every mode.
export { isAiActionMessage, isCopilotLine, isOnDemandAiMessage, isPushedAiMessage } from "@/contact-handling/ai-card-kinds";
