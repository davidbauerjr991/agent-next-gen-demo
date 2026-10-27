// The outcome form per kind (P-HOME-1d: the Outcome popover on a kind card;
// P-HOME-3 gives each kind its full shape): a meeting's notes and action
// items, a training's completion and score, a task's ticket status and note,
// a callback's or conversation's disposition. Saving completes the item
// through the schedule source; nothing is written until the agent saves.
// P-HOME-1f: the fields and the save are separate, so the popover lays them
// out in its header / content / footer slots as the conversation's does.
import * as React from "react";
import { Checkbox, DispositionSelect, Input, Select, Textarea } from "@nicecxone/lyra-ui";
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

/** What the card's call wrap-up fills in (P-HOME-1g): its disposition and summary. */
export interface KindOutcomeFill {
  disposition: string;
  note: string;
}

/** A kind's outcome form: its fields, whether it can be saved, and the outcome it records. `fill` is the card's call
 *  wrap-up: a disposition-shaped kind (a callback) takes its disposition and summary as they're written; a task keeps
 *  its ticket status (the call's summary joins its notes instead). */
export function useKindOutcomeForm(
  item: ScheduleItem,
  fill?: KindOutcomeFill,
): { fields: React.ReactNode; canSave: boolean; outcome: () => ScheduleOutcome } {
  const shape = outcomeShapeOf(item.kind);
  const [note, setNote] = React.useState("");
  const [actionItems, setActionItems] = React.useState("");
  const [completed, setCompleted] = React.useState(false);
  const [score, setScore] = React.useState("");
  const [ticketStatus, setTicketStatus] = React.useState<string>("Pending");
  const [disposition, setDisposition] = React.useState("");
  const fills = shape === "disposition" && !!fill;
  React.useEffect(() => {
    if (fills && fill.disposition) setDisposition(fill.disposition);
  }, [fills, fill?.disposition]); // eslint-disable-line react-hooks/exhaustive-deps
  React.useEffect(() => {
    if (fills && fill.note) setNote(fill.note);
  }, [fills, fill?.note]); // eslint-disable-line react-hooks/exhaustive-deps

  const outcome = () => {
    const result: ScheduleOutcome = { ...(note.trim() ? { note: note.trim() } : {}) };
    if (shape === "notes") {
      const lines = actionItems.split("\n").map((l) => l.trim()).filter(Boolean);
      if (lines.length) result.actionItems = lines;
    }
    if (shape === "completion") {
      result.completed = completed;
      const n = Number(score);
      if (score.trim() && Number.isFinite(n)) result.score = n;
    }
    if (shape === "ticket") result.ticketStatus = ticketStatus;
    if (shape === "disposition" && disposition) result.disposition = disposition;
    return result;
  };

  const fields = (
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
    </div>
  );

  return { fields, canSave: shape !== "disposition" || !!disposition, outcome };
}
