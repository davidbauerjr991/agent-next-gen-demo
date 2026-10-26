// The outcome form per kind (P-HOME-1d: the Outcome popover on a kind card;
// P-HOME-3 gives each kind its full shape): a meeting's notes and action
// items, a training's completion and score, a task's ticket status and note,
// a callback's or conversation's disposition. Saving completes the item
// through the schedule source; nothing is written until the agent saves.
import * as React from "react";
import { Button, Checkbox, DispositionSelect, Input, Select, Textarea } from "@nicecxone/lyra-ui";
import { OUTCOME_DISPOSITION_OPTIONS } from "@/components/transcript/transcript-fixtures";
import type { ScheduleItem, ScheduleOutcome } from "@/providers";
import { t } from "@/i18n";

const TICKET_STATUSES = ["Open", "Pending", "Solved"] as const;

/** Which form a kind's outcome takes. */
export type OutcomeShape = "notes" | "completion" | "ticket" | "disposition";

export function outcomeShapeOf(kind: ScheduleItem["kind"]): OutcomeShape {
  if (kind === "meeting") return "notes";
  if (kind === "training") return "completion";
  if (kind === "task") return "ticket";
  if (kind === "callback" || kind === "conversation") return "disposition";
  return "notes";
}

export function KindOutcomeForm({ item, onSave, onCancel }: { item: ScheduleItem; onSave: (outcome: ScheduleOutcome) => void; onCancel?: () => void }) {
  const shape = outcomeShapeOf(item.kind);
  const [note, setNote] = React.useState("");
  const [actionItems, setActionItems] = React.useState("");
  const [completed, setCompleted] = React.useState(false);
  const [score, setScore] = React.useState("");
  const [ticketStatus, setTicketStatus] = React.useState<string>("Pending");
  const [disposition, setDisposition] = React.useState("");

  const save = () => {
    const outcome: ScheduleOutcome = { ...(note.trim() ? { note: note.trim() } : {}) };
    if (shape === "notes") {
      const lines = actionItems.split("\n").map((l) => l.trim()).filter(Boolean);
      if (lines.length) outcome.actionItems = lines;
    }
    if (shape === "completion") {
      outcome.completed = completed;
      const n = Number(score);
      if (score.trim() && Number.isFinite(n)) outcome.score = n;
    }
    if (shape === "ticket") outcome.ticketStatus = ticketStatus;
    if (shape === "disposition" && disposition) outcome.disposition = disposition;
    onSave(outcome);
  };

  return (
    <div className="flex flex-col gap-4" data-kind-outcome={shape}>
      {shape === "disposition" && (
        <DispositionSelect label={t("Disposition")} options={OUTCOME_DISPOSITION_OPTIONS} value={disposition} onValueChange={setDisposition} />
      )}
      {shape === "completion" && (
        <>
          <Checkbox label={t("Module completed")} checked={completed} onCheckedChange={(c) => setCompleted(c === true)} />
          <Input label={t("Quiz score")} type="number" value={score} onChange={(e) => setScore(e.target.value)} />
        </>
      )}
      {shape === "ticket" && (
        <Select
          label={t("Ticket status")}
          options={TICKET_STATUSES.map((s) => ({ value: s, label: t(s) }))}
          value={ticketStatus}
          onValueChange={setTicketStatus}
        />
      )}
      {shape !== "completion" && (
        <Textarea label={shape === "notes" ? t("Notes") : t("Note")} value={note} onChange={(e) => setNote(e.target.value)} />
      )}
      {shape === "notes" && (
        <Textarea label={t("Action items")} labelHelpText={t("One per line.")} value={actionItems} onChange={(e) => setActionItems(e.target.value)} />
      )}
      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button variant="outline" size="md" onClick={onCancel}>
            {t("Cancel")}
          </Button>
        )}
        <Button variant="default" size="md" onClick={save} disabled={shape === "disposition" && !disposition}>
          {t("Save outcome")}
        </Button>
      </div>
    </div>
  );
}
