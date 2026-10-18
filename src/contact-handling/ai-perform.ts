/** How long an AI instruction row shows "AI agent is performing this now…" after it's made, when its source
 *  doesn't say (P-EXTRACT): rows the workspace makes itself (Copilot asks) and a provider's instruction without
 *  `performedAt`. The row's `performedAt` = made + this, so the step is timed from the row, not from a mount. */
export const AI_PERFORM_MS = 1800;
