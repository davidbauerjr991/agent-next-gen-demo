import React from "react";
import { Badge } from "@nicecxone/lyra-ui";
import { Sparkles } from "lucide-react";
import { copilotAnswerForRow, copilotResultFor } from "@/contact-handling/copilot-results";

// The slide-over body for a Copilot result row on a contact with no script
// (any channel): the registry's result for the question (copilot-results.ts),
// the AssistProvider's answer once it came (P-LAYOUT-F2 5b).

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="lyra-body-sm-emphasis text-lyra-fg-default">{label}</p>
      <div className="lyra-body-md text-lyra-fg-default">{children}</div>
    </div>
  );
}

export function CopilotResultPanelBody({
  text,
  time,
  by = "John Smith",
  link,
  answer = (link ? copilotAnswerForRow(link) : undefined) ?? copilotResultFor(text) ?? { summary: "", points: [] },
}: {
  text: string;
  time: string;
  by?: string;
  /** The row's link: its own answer from the provider. */
  link?: string;
  /** A scripted answer (a kind cell's, P-HOME-1f); else the row's own answer, else the question's registered result. */
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
