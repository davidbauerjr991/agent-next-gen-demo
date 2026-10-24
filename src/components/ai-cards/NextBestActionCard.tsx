import { useId, useState } from "react";
import { Alternatives, AgenticAICard, Button, Input, Label, SuggestedReply, SuggestionTag, Textarea } from "@nicecxone/lyra-ui";
import { Compass, Copy, CornerDownLeft, Lightbulb, MessageSquareQuote, Play, Workflow, X } from "lucide-react";
import type { NextBestActionNote, NextBestActionSuggestion } from "@/providers";
import { t } from "@/i18n";
import { aiCardIcon as ic, timeLabel } from "./ai-card-icon";

/** Whether a note's value lets the option run: a required note needs text, an amount a number above zero. */
function noteReady(note: NextBestActionNote | undefined, value: string): boolean {
  if (!note) return true;
  const v = value.trim();
  if (note.kind === "amount") return v === "" ? !note.required : Number(v) > 0;
  return !note.required || v !== "";
}

/** A Do's (or an alternative's) field: an amount input or a short text box. */
function NoteField({ note, value, onChange }: { note: NextBestActionNote; value: string; onChange: (value: string) => void }) {
  const id = useId();
  if (note.kind === "amount") {
    return <Input label={note.label} required={note.required} inputMode="decimal" placeholder={note.placeholder} value={value} onChange={(e) => onChange(e.target.value)} />;
  }
  return (
    <div className="flex flex-col gap-1.5">
      <Label label={note.label} labelFor={id} />
      <Textarea id={id} rows={2} placeholder={note.placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

/** How a Say or Ask is used: into the chat composer, said on the call, or
 *  copied (a thread with no reply composer, e.g. email until P-PARKED). */
export type NextBestActionUse = "insert" | "said" | "copy";

export interface NextBestActionCardProps {
  /** The surfaced suggestion; none reads "Nothing to suggest" (the answer to the agent's request). */
  suggestion?: NextBestActionSuggestion;
  stepId?: string;
  use?: NextBestActionUse;
  /** `note`: what the agent typed into the Do's field, when it has one. */
  onUse?: (note?: string) => void;
  onCopy?: () => void;
  onNotNow?: () => void;
  /** `note`: what the agent typed into the alternative's field, when it has one. */
  onUseAlternative?: (index: number, note?: string) => void;
}

/** Next Best Action (P-CANVAS), lyra's Agentic AI card as its story mirrors
 *  it (AgenticAICard.shared.tsx): a Say | Ask | Do suggestion, or Nothing to
 *  suggest. A row in the conversation, surfaced on a pause or on request. */
export function NextBestActionCard({ suggestion, stepId, use = "copy", onUse, onCopy, onNotNow, onUseAlternative }: NextBestActionCardProps) {
  const base = { title: t("Next Best Action"), icon: ic(Compass), forYou: true } as const;
  const [note, setNote] = useState("");
  // An alternative with a field is picked first, then run from its own field (P-SHRINK).
  const [altPicked, setAltPicked] = useState<number | undefined>(undefined);
  const [altNote, setAltNote] = useState("");

  if (!suggestion) {
    return (
      <div data-slot="next-best-action" data-frame="nothing">
        <AgenticAICard {...base} status="waiting" statusLabel={t("On track")}>
          <p className="lyra-body-md text-lyra-fg-secondary">{t("Nothing to suggest right now — the conversation is on track.")}</p>
        </AgenticAICard>
      </div>
    );
  }

  const at = timeLabel(suggestion.at);
  const isDo = suggestion.type === "do";
  const picked = altPicked !== undefined ? suggestion.alt[altPicked] : undefined;
  const footer = isDo ? (
    <>
      <Button size="sm" disabled={!noteReady(suggestion.note, note)} onClick={() => onUse?.(suggestion.note ? note : undefined)}>
        {ic(Play)}
        {t("Run it")}
      </Button>
      <span className="flex-1" />
      <Button variant="ghost" size="sm" onClick={onNotNow}>
        {ic(X)}
        {t("Not now")}
      </Button>
    </>
  ) : (
    <>
      {use === "insert" && (
        <Button size="sm" onClick={() => onUse?.()}>
          {ic(CornerDownLeft)}
          {t("Insert into reply")}
        </Button>
      )}
      {use === "said" && (
        <Button size="sm" onClick={() => onUse?.()}>
          {ic(MessageSquareQuote)}
          {t("Said it")}
        </Button>
      )}
      <Button variant={use === "copy" ? "default" : "outline"} size="sm" onClick={onCopy}>
        {ic(Copy)}
        {t("Copy")}
      </Button>
      <span className="flex-1" />
      <Button variant="ghost" size="sm" onClick={onNotNow}>
        {ic(X)}
        {t("Not now")}
      </Button>
    </>
  );

  return (
    <div data-slot="next-best-action" data-frame={suggestion.type} data-step={stepId}>
      <AgenticAICard
        {...base}
        status={isDo ? "needs-you" : "suggested"}
        statusLabel={isDo ? undefined : t("1 suggestion")}
        subhead={t("From a flow · {time}", { time: at })}
        footer={footer}
      >
        <div className="flex flex-col gap-2">
          <SuggestionTag type={suggestion.type} />
          <p className="lyra-body-md-emphasis text-lyra-fg-default">{suggestion.title}</p>
          <p className="flex gap-1.5 lyra-body-sm text-lyra-fg-secondary">
            <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-lyra-status-warning-strong" strokeWidth={1.5} aria-hidden="true" />
            {suggestion.why}
          </p>
          {suggestion.text ? (
            <SuggestedReply>{suggestion.text}</SuggestedReply>
          ) : (
            <p className="flex items-center gap-1.5 lyra-body-sm text-lyra-fg-secondary">
              <Workflow className="h-3.5 w-3.5 shrink-0 text-lyra-fg-active-strong" strokeWidth={1.5} aria-hidden="true" />
              {suggestion.action}
            </p>
          )}
          {isDo && suggestion.note && <NoteField note={suggestion.note} value={note} onChange={setNote} />}
        </div>
        {suggestion.alt.length > 0 && (
          <Alternatives
            label={t("Also consider")}
            alternatives={suggestion.alt.map((a, i) => ({
              type: a.type,
              text: a.text,
              onUse: () => {
                if (!a.note) return onUseAlternative?.(i);
                setAltPicked(i);
                setAltNote("");
              },
            }))}
          />
        )}
        {picked?.note && altPicked !== undefined && (
          <div className="flex flex-col gap-2" data-slot="nba-alternative-note">
            <p className="lyra-body-md-emphasis text-lyra-fg-default">{picked.text}</p>
            <NoteField note={picked.note} value={altNote} onChange={setAltNote} />
            <div className="flex items-center gap-2">
              <Button size="sm" disabled={!noteReady(picked.note, altNote)} onClick={() => onUseAlternative?.(altPicked, altNote)}>
                {ic(Play)}
                {t("Run it")}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setAltPicked(undefined)}>
                {t("Cancel")}
              </Button>
            </div>
          </div>
        )}
      </AgenticAICard>
    </div>
  );
}
