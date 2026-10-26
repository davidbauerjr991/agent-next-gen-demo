import React from "react";
import { Badge } from "@nicecxone/lyra-ui";
import { Sparkles } from "lucide-react";

// The slide-over body for a Copilot result row on a contact with no script
// (any channel). There's no AssistProvider answer yet (P4.8), so the result
// is a placeholder shaped like the scripted cases' results.

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="lyra-body-sm-emphasis text-lyra-fg-default">{label}</p>
      <div className="lyra-body-md text-lyra-fg-default">{children}</div>
    </div>
  );
}

function placeholderAnswer(question: string): { summary: string; points: string[] } {
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

export function CopilotResultPanelBody({
  text,
  time,
  by = "John Smith",
  answer = placeholderAnswer(text),
}: {
  text: string;
  time: string;
  by?: string;
  /** A scripted answer (a kind cell's, P-HOME-1f); else the placeholder for the question. */
  answer?: { summary: string; points: readonly string[] };
}) {
  return (
    <div data-slot="copilot-result" className="flex flex-col gap-4 p-4">
      <div className="flex flex-col gap-2 rounded-lyra-md border border-lyra-border-subtle bg-lyra-bg-surface-base p-3">
        <p className="flex items-center gap-1.5 lyra-body-sm-emphasis text-lyra-accent-purple-strong">
          <Sparkles className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
          Copilot result
        </p>
        <p className="lyra-body-md text-lyra-fg-default">{answer.summary}</p>
        <ul className="flex list-disc flex-col gap-1 pl-5 lyra-body-md text-lyra-fg-default">
          {answer.points.map((pt) => (
            <li key={pt}>{pt}</li>
          ))}
        </ul>
      </div>
      <Field label="Instruction">{text}</Field>
      <Field label="Sent">
        {time} · by {by}
      </Field>
      <Field label="Sent to">Copilot</Field>
      <Field label="Status">
        <Badge shape="pill" color="success" variant="subtle" fontSize={12}>
          Answered
        </Badge>
      </Field>
    </div>
  );
}
