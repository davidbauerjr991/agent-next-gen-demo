// The placeholder outcome form per kind (P-HOME-1; P-HOME-3 gives each kind
// its full outcome shape): a meeting's notes and action items, a training's
// completion and score, a task's ticket status, a note for the rest. Saving
// completes the item through the schedule source; nothing is written until
// the agent saves.
import * as React from "react";
import { Button, Checkbox, Container, Input, Select, Textarea } from "@nicecxone/lyra-ui";
import type { ScheduleItem, ScheduleOutcome } from "@/providers";
import { t } from "@/i18n";

const TICKET_STATUSES = ["Open", "Pending", "Solved"] as const;

const OUTCOME_TITLES: Partial<Record<ScheduleItem["kind"], string>> = {
  meeting: "Outcome · notes and action items",
  training: "Outcome · completion",
  task: "Outcome · ticket status",
};

export function OutcomePlaceholder({ item, onSave }: { item: ScheduleItem; onSave: (outcome: ScheduleOutcome) => void }) {
  const [note, setNote] = React.useState("");
  const [actionItems, setActionItems] = React.useState("");
  const [completed, setCompleted] = React.useState(false);
  const [score, setScore] = React.useState("");
  const [ticketStatus, setTicketStatus] = React.useState<string>("Pending");

  const save = () => {
    const outcome: ScheduleOutcome = { ...(note.trim() ? { note: note.trim() } : {}) };
    if (item.kind === "meeting") {
      const lines = actionItems.split("\n").map((l) => l.trim()).filter(Boolean);
      if (lines.length) outcome.actionItems = lines;
    }
    if (item.kind === "training") {
      outcome.completed = completed;
      const n = Number(score);
      if (score.trim() && Number.isFinite(n)) outcome.score = n;
    }
    if (item.kind === "task") outcome.ticketStatus = ticketStatus;
    onSave(outcome);
  };

  return (
    <Container variant="neutral-subtle" headerTitle={t(OUTCOME_TITLES[item.kind] ?? "Outcome")} data-kind-outcome={item.kind}>
      <div className="flex flex-col gap-4">
        {item.kind === "training" && (
          <>
            <Checkbox label={t("Module completed")} checked={completed} onCheckedChange={(c) => setCompleted(c === true)} />
            <div className="max-w-xs">
              <Input label={t("Quiz score")} type="number" value={score} onChange={(e) => setScore(e.target.value)} />
            </div>
          </>
        )}
        {item.kind === "task" && (
          <div className="max-w-xs">
            <Select
              label={t("Ticket status")}
              options={TICKET_STATUSES.map((s) => ({ value: s, label: t(s) }))}
              value={ticketStatus}
              onValueChange={setTicketStatus}
            />
          </div>
        )}
        <Textarea label={item.kind === "meeting" ? t("Notes") : t("Note")} value={note} onChange={(e) => setNote(e.target.value)} />
        {item.kind === "meeting" && (
          <Textarea
            label={t("Action items")}
            labelHelpText={t("One per line.")}
            value={actionItems}
            onChange={(e) => setActionItems(e.target.value)}
          />
        )}
        <div className="flex justify-end">
          <Button variant="default" size="md" onClick={save}>
            {t("Save outcome")}
          </Button>
        </div>
      </div>
    </Container>
  );
}
