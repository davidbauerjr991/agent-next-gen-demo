// The redaction seam (CLAUDE.md: raw message, utterance or transcript text
// reaches LLMProvider, AssistProvider, BotAgentProvider or ReportingSink only
// through `redact()`). Until P-COMPLIANCE this is an identity pass-through;
// P-COMPLIANCE swaps in a RedactionProvider that masks cardholder data, SSNs
// and the vertical's PHI fields. Call sites don't change.

export interface RedactionProvider {
  redact(text: string): string;
}

export const identityRedaction: RedactionProvider = { redact: (text) => text };

export function redact(text: string): string {
  return identityRedaction.redact(text);
}
