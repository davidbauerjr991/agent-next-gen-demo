// The AI rows: the feed, the AI action card and its kinds (instruction, wrap-up, save-address, approval)
// (P-EXTRACT: split out of agent-next-gen-transcript.tsx).
import React, { useEffect, useState } from "react";
import { AICard, Badge, Button, Label, Link, Tag, Textarea } from "@nicecxone/lyra-ui";
import { AlertCircle, CheckCircle2, History, Sparkles, UserCheck } from "lucide-react";
import { KnowledgeArticleSummaryRow } from "@/components/agent-next-gen-knowledge-article-card";
import { isAiActionMessage } from "@/components/agent-next-gen-ai-messages";
import { SaveAddressCard } from "@/contact-handling/SaveAddressCard";
import { useWorkspaceUiField } from "@/contact-handling/workspace-ui-store";
import { cn } from "@/lib/utils";
import type { ApprovalDecisionDef, TranscriptApprovalSummary, TranscriptMessage } from "../transcript-types";
import { InstructionInterstitial } from "./InstructionInterstitial";
import { NbaOutcomeRow } from "./NbaOutcomeRow";

/**
 * Settings → AI display "In the Contact Details panel" (P-SETTINGS, ported
 * from v3): the AI cards that normally sit inline in the transcript
 * (instruction interstitials, approval request summaries, wrap-up cards)
 * rendered as a stacked feed for the Contact Details panel instead. Event
 * rows stay in the transcript. `overview` is the (already built) Autosummary block shown first.
 * Same components and handlers the inline transcript uses, so behavior
 * matches.
 */
export function AiActionsFeed({
  messages,
  overview,
  onApprovalDecision,
  onApprovalCallRequest,
  onApprovalSuggestionAsk,
  approvalTakenOver,
  onWrapUpComplete,
  onSnapshotLink,
  activeSnapshotLink,
}: {
  messages: TranscriptMessage[];
  overview?: React.ReactNode;
  onApprovalDecision?: (value: string, note: string) => void;
  onApprovalCallRequest?: (req: { value: string; anchorEl: HTMLElement; confirm: () => void }) => void;
  onApprovalSuggestionAsk?: (text: string) => void;
  approvalTakenOver?: boolean;
  onWrapUpComplete?: () => void;
  onSnapshotLink?: (key: string) => void;
  activeSnapshotLink?: string;
}) {
  const aiMessages = messages.filter(isAiActionMessage);
  if (!overview && aiMessages.length === 0) return null;
  const handlers = { onApprovalDecision, onApprovalCallRequest, onApprovalSuggestionAsk, approvalTakenOver, onWrapUpComplete, onSnapshotLink, activeSnapshotLink };
  return (
    <div className="flex flex-col gap-3">
      {overview}
      {aiMessages.map((message) => (
        <AiActionCard key={message.id} message={message} {...handlers} />
      ))}
    </div>
  );
}

export interface AiActionCardHandlers {
  onApprovalDecision?: (value: string, note: string) => void;
  onApprovalCallRequest?: (req: { value: string; anchorEl: HTMLElement; confirm: () => void }) => void;
  onApprovalSuggestionAsk?: (text: string) => void;
  approvalTakenOver?: boolean;
  onWrapUpComplete?: () => void;
  onSnapshotLink?: (key: string) => void;
  activeSnapshotLink?: string;
}

/** One AI action (an instruction row, the wrap-up card or an approval
 *  request), the same in every placement: interleaved with the transcript
 *  (AI display inline) or in the AI feed (panel and "main"). */
export function AiActionCard({
  message,
  onApprovalDecision,
  onApprovalCallRequest,
  onApprovalSuggestionAsk,
  approvalTakenOver,
  onWrapUpComplete,
  onSnapshotLink,
  activeSnapshotLink,
}: { message: TranscriptMessage } & AiActionCardHandlers) {
  if (message.instruction) {
    return (
      <InstructionInterstitial
        id={message.id}
        instruction={message.instruction}
        timestamp={message.timestamp}
        onOpen={(link) => onSnapshotLink?.(link)}
        active={activeSnapshotLink === message.instruction.link}
      />
    );
  }
  if (message.wrapUp) return <WrapUpAccordion message={message} onComplete={onWrapUpComplete} />;
  if (message.saveAddress) return <SaveAddressCard id={message.id} offer={message.saveAddress} timestamp={message.timestamp} />;
  if (message.nbaOutcome) return <NbaOutcomeRow outcome={message.nbaOutcome} />;
  return (
    <ApprovalSummaryAccordion
      message={message}
      onDecide={onApprovalDecision}
      onCallRequest={onApprovalCallRequest}
      onLink={onSnapshotLink}
      onSuggestionAsk={onApprovalSuggestionAsk}
      takenOver={approvalTakenOver}
    />
  );
}

/** "Wrap up" card: same accordion shell as the approval request, with a success-subtle header, the AI-written summary and a "Complete wrap-up" button. */
function WrapUpAccordion({ message, onComplete }: { message: TranscriptMessage; onComplete?: () => void }) {
  const [open, setOpen] = useState(true);
  const [completed, setCompleted] = useState(false);
  const wrapUp = message.wrapUp!;
  // Withdrawn already when it mounted (e.g. after a tier switch): nothing to
  // animate out. Otherwise it removes itself once the exit animation ends.
  const [withdrawnOnMount] = useState(!!wrapUp.exiting);
  const [gone, setGone] = useState(false);
  if (withdrawnOnMount || gone) return null;
  return (
    // `exiting` (the agent took over instead of wrapping up) collapses and fades the whole card out before it is removed.
    <div
      onTransitionEnd={(e) => {
        if (wrapUp.exiting && e.target === e.currentTarget) setGone(true);
      }}
      className={cn(
        "grid transition-[grid-template-rows,opacity] duration-300 ease-out",
        wrapUp.exiting ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr] opacity-100"
      )}
    >
    <div className="min-h-0 overflow-hidden">
    {/* lyra AICard (green), not a hand-built accordion. */}
    <AICard
      title={
        <>
          {wrapUp.title} <span className="lyra-body-md font-normal text-lyra-fg-secondary">{message.timestamp}</span>
        </>
      }
      color="green"
      radius="md"
      density="compact"
      icon={<Sparkles className="h-4 w-4" strokeWidth={1.5} />}
      headerEnd={<span className="lyra-body-sm font-normal text-lyra-fg-secondary">Copilot summary</span>}
      open={open}
      onOpenChange={setOpen}
    >
          <div className="flex flex-col gap-3">
            <p className="lyra-body-md text-lyra-fg-default">{wrapUp.summary}</p>
            <p className="lyra-body-sm text-lyra-fg-secondary">{wrapUp.disposition}</p>
            <div data-ai-action="">
              {completed ? (
                <span className="inline-flex items-center gap-1.5 lyra-body-md-emphasis text-lyra-status-success-strong">
                  <CheckCircle2 className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
                  Wrap-up completed
                </span>
              ) : (
                <Button
                  variant="default"
                  size="md"
                  className="gap-1.5"
                  onClick={() => {
                    setCompleted(true);
                    onComplete?.();
                  }}
                >
                  <CheckCircle2 className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
                  {wrapUp.buttonLabel}
                </Button>
              )}
            </div>
          </div>
    </AICard>
    </div>
    </div>
  );
}

/** Marcus-style decision flow: pick an option → (optional note) → Perform Task. What happens next (working, events, the AI replying to the customer) plays out in the chat via `onDecide`, not inside this card. */
export function ApprovalDecision({
  decisions,
  onDecide,
  onLink,
  onSuggestionAsk,
  onCallRequest,
  takenOver,
  decided,
}: {
  /** A decision already made (e.g. before a tier switch): the card starts decided. */
  decided?: { value: string; note?: string };
  /** The human agent took over the chat before deciding: options go away and a note replaces them. */
  takenOver?: boolean;
  /** Fired for `callRequest` decisions: the option's element (popover anchor) and a `confirm` that marks the card as decided once the call is launched. */
  onCallRequest?: (req: { value: string; anchorEl: HTMLElement; confirm: () => void }) => void;
  decisions: ApprovalDecisionDef[];
  onDecide?: (value: string, note: string) => void;
  onLink?: (key: string) => void;
  /** Fired when a link suggestion is clicked, so the chat can log the lookup (same row Ask Copilot adds). */
  onSuggestionAsk?: (text: string) => void;
}) {
  const decidedOnce = decided && !decisions.find((d) => d.value === decided.value)?.repeatable ? decided : undefined;
  const [selected, setSelected] = useState<string | undefined>(decidedOnce?.value);
  const [note, setNote] = useState(decidedOnce?.note ?? "");
  const [submitted, setSubmitted] = useState(!!decidedOnce);
  // Brief interstitial while a suggestion that opens a panel (e.g. purchase history) "loads".
  const [loadingLabel, setLoadingLabel] = useState<string | null>(null);
  // Link suggestions already used: they are dropped and swapped for their replacement.
  const [usedSuggestions, setUsedSuggestions] = useState<string[]>([]);
  const option = decisions.find((d) => d.value === selected);
  const needsNote = !!option?.notePlaceholder;
  const activateSuggestion = (suggestion: string) => {
    const link = option?.suggestionLinks?.[suggestion];
    if (!link) {
      setNote(suggestion);
      return;
    }
    setLoadingLabel(suggestion);
    onSuggestionAsk?.(suggestion);
    window.setTimeout(() => {
      setLoadingLabel(null);
      setUsedSuggestions((prev) => [...prev, suggestion]);
      onLink?.(link);
    }, 1400);
  };
  const submit = (value: string, text: string) => {
    onDecide?.(value, text.trim());
    if (decisions.find((d) => d.value === value)?.repeatable) {
      // Keep the option area open for another "Something else" instruction.
      setNote("");
      return;
    }
    setSubmitted(true);
  };
  return (
    // `data-ai-action`: a click in here is the agent acting on the card; in
    // AI panel mode the Contact Details body follows it to the bottom.
    <div data-ai-action="" className="flex flex-col gap-3 border-t border-lyra-border-subtle pt-3">
      {!submitted && takenOver && (
        <div className="flex items-center gap-2 lyra-body-md text-lyra-fg-secondary animate-in fade-in-0 duration-200">
          <UserCheck className="h-4 w-4 shrink-0" strokeWidth={1.5} aria-hidden="true" />
          Agent has taken over the chat
        </div>
      )}
      {!submitted && !takenOver && (
        <>
          <p className="lyra-body-md-emphasis text-lyra-fg-default">How would you like to proceed?</p>
          <div className="flex flex-wrap gap-2" role="radiogroup">
            {/* A call request with no call handler (Outbound Calling → Elevation off) isn't offered. */}
            {decisions.filter((d) => !d.callRequest || onCallRequest).map((d) => {
              const isSelected = selected === d.value;
              return (
                <button
                  key={d.value}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  onClick={(e) => {
                    setSelected(d.value);
                    if (d.callRequest && onCallRequest) {
                      onCallRequest({ value: d.value, anchorEl: e.currentTarget, confirm: () => submit(d.value, "") });
                      return;
                    }
                    // No note needed (e.g. Accept) — submit immediately, no Perform Task button.
                    if (!d.notePlaceholder && !d.panel) submit(d.value, "");
                  }}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lyra-md border px-3 py-2 lyra-body-md-emphasis text-lyra-fg-default transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lyra-border-focus",
                    isSelected
                      ? "border-lyra-border-active bg-lyra-bg-active-subtle"
                      : "border-lyra-border-subtle bg-lyra-bg-surface-base hover:border-lyra-state-border-hover-neutral"
                  )}
                >
                  {isSelected && (
                    <CheckCircle2 className="h-4 w-4 text-lyra-status-success-strong" strokeWidth={1.5} aria-hidden="true" />
                  )}
                  {d.title}
                </button>
              );
            })}
          </div>
          {option?.description && <p className="lyra-body-sm text-lyra-fg-secondary">{option.description}</p>}
          {option?.panel && (
            <div className="flex flex-col gap-3 animate-in slide-in-from-bottom-2 fade-in-0 duration-200">
              <div className="flex flex-col gap-1.5 rounded-lyra-lg border border-lyra-border-subtle bg-lyra-bg-surface-base px-4 py-3">
                <p className="lyra-body-lg-emphasis text-lyra-fg-default">{option.panel.headline}</p>
                <p className="lyra-body-md text-lyra-fg-secondary">{option.panel.description}</p>
                <p className="flex items-start gap-1.5 lyra-body-md text-lyra-accent-purple-strong">
                  <History className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.5} aria-hidden="true" />
                  {option.panel.memory}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-3">
                  <div className="flex min-w-0 flex-col rounded-lyra-lg border border-lyra-border-subtle bg-lyra-bg-surface-base px-4 py-2.5">
                    <span className="lyra-body-md-emphasis text-lyra-fg-default">{option.panel.card.title}</span>
                    <span className="lyra-body-sm text-lyra-fg-secondary">{option.panel.card.sub}</span>
                  </div>
                  {option.panel.article && (
                  <KnowledgeArticleSummaryRow
                    data={{ id: option.panel.article!.link, title: option.panel.article!.label, body: "", internalNote: "", webLinks: [], processSteps: [] }}
                    selected={false}
                    onClick={() => onLink?.(option.panel!.article!.link)}
                  />
                  )}
                </div>
              </div>
              <Button variant="default" size="md" className="self-start" onClick={() => submit(option.value, "")}>
                {option.panel.confirmLabel}
              </Button>
            </div>
          )}
          {option?.suggestions && option.suggestions.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {option.suggestions
                .map((sg) => (usedSuggestions.includes(sg) ? option.suggestionReplacements?.[sg] : sg))
                .filter((sg): sg is string => !!sg && !usedSuggestions.includes(sg))
                .map((suggestion) => (
                <Tag
                  key={suggestion}
                  label={suggestion}
                  variant="purple"
                  icon={<Sparkles className="h-3 w-3" strokeWidth={1.5} aria-hidden="true" />}
                  shape="pill"
                  role="button"
                  tabIndex={0}
                  className="cursor-pointer"
                  onClick={() => activateSuggestion(suggestion)}
                  onKeyDown={(e: React.KeyboardEvent<HTMLSpanElement>) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      activateSuggestion(suggestion);
                    }
                  }}
                />
              ))}
            </div>
          )}
          {needsNote && (
            <div className="flex flex-col gap-1.5">
              {option?.noteLabel && <Label label={option.noteLabel} labelFor="approval-decision-note" />}
              <Textarea
                id="approval-decision-note"
                rows={3}
                placeholder={option?.notePlaceholder}
                value={note}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNote(e.target.value)}
              />
            </div>
          )}
          {selected && needsNote && (
            <Button
              variant="default"
              size="md"
              className="self-start"
              disabled={note.trim().length === 0}
              onClick={() => submit(selected, note)}
            >
              Perform Task
            </Button>
          )}
        </>
      )}
      {submitted && option && (
        <div className="flex items-center gap-1.5 lyra-body-md-emphasis text-lyra-fg-default animate-in fade-in-0 duration-200">
          <CheckCircle2 className="h-4 w-4 text-lyra-status-success-strong" strokeWidth={1.5} aria-hidden="true" />
          {option.result}
        </div>
      )}
    </div>
  );
}

function ApprovalSummaryAccordion({
  message,
  onDecide,
  onLink,
  onSuggestionAsk,
  onCallRequest,
  takenOver,
  footer,
}: {
  onCallRequest?: (req: { value: string; anchorEl: HTMLElement; confirm: () => void }) => void;
  takenOver?: boolean;
  /** Custom decision footer (e.g. Marcus's own picker) rendered in place of the built-in decisions; stays visible when collapsed. */
  footer?: React.ReactNode;
  message: TranscriptMessage;
  onDecide?: (value: string, note: string) => void;
  onLink?: (key: string) => void;
  onSuggestionAsk?: (text: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const [showMore, setShowMore] = useState(false);
  const summary = message.summary!;
  const hasDetails =
    !summary.hideDetails && (summary.checklist.length > 0 || summary.memory.length > 0 || !!summary.sentimentValue);
  // The decision footer stays visible (options pending) when the summary is
  // collapsed: AICard's `persistentFooter`.
  const decisionFooter = footer ?? (summary.decisions && summary.decisions.length > 0 ? (
    <ApprovalDecision decisions={summary.decisions} onDecide={onDecide} onLink={onLink} onSuggestionAsk={onSuggestionAsk} onCallRequest={onCallRequest} takenOver={takenOver} decided={message.decided} />
  ) : undefined);
  return (
    // lyra AICard (blue, as v3 since lyra 71160d3), not a hand-built accordion.
    <AICard
      title={
        <>
          {summary.title} <span className="lyra-body-md font-normal text-lyra-fg-secondary">{message.timestamp}</span>
        </>
      }
      color="blue"
      radius="md"
      density="compact"
      icon={<Sparkles className="h-4 w-4" strokeWidth={1.5} />}
      headerEnd={<span className="lyra-body-sm font-normal text-lyra-fg-secondary">Copilot summary</span>}
      open={open}
      onOpenChange={setOpen}
      persistentFooter={decisionFooter}
    >
        <div className="flex flex-col gap-3">
          <p className="lyra-body-lg-emphasis text-lyra-fg-default">{summary.headline}</p>
          <p className="lyra-body-md text-lyra-fg-default">{summary.description}</p>
          {hasDetails && (
            <Link onClick={() => setShowMore((v) => !v)} aria-expanded={showMore} className="self-start">
              {showMore ? "Show less" : "Show more"}
            </Link>
          )}
          {hasDetails && (
          <div
            className={cn(
              "grid transition-[grid-template-rows,opacity] duration-300 ease-out",
              showMore ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
            )}
            aria-hidden={!showMore}
          >
          <div className="min-h-0 overflow-hidden">
          <div className={cn("grid gap-6 pt-1", summary.checklist.length > 0 && (summary.memory.length > 0 || !!summary.sentimentValue) && "md:grid-cols-2")}>
            {summary.checklist.length > 0 && (
            <ul className="flex flex-col gap-3">
              {summary.checklist.map((item) => (
                <li key={item.label} className="flex items-start gap-2">
                  {item.status === "done" ? (
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-lyra-status-success-strong" strokeWidth={1.5} aria-hidden="true" />
                  ) : (
                    <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-lyra-status-warning-strong" strokeWidth={1.5} aria-hidden="true" />
                  )}
                  <div className="flex min-w-0 flex-col">
                    <span className="flex flex-wrap items-center gap-2 lyra-body-md-emphasis text-lyra-fg-default">
                      {item.link && onLink ? (
                        <Link onClick={() => onLink(item.link!)} className="text-left">
                          {item.label}
                        </Link>
                      ) : (
                        item.label
                      )}
                      {item.badge && (
                        <Badge shape="pill" color="warning" variant="subtle" fontSize={12}>
                          {item.badge}
                        </Badge>
                      )}
                    </span>
                    <span className="lyra-body-md text-lyra-fg-secondary">{item.detail}</span>
                  </div>
                </li>
              ))}
            </ul>
            )}
            {(summary.memory.length > 0 || !!summary.sentimentValue) && (
            <div className="flex flex-col gap-2">
              <span className="flex items-center gap-1.5 lyra-body-sm-emphasis text-lyra-accent-purple-strong">
                <History className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
                {summary.memoryTitle}
              </span>
              <ul className="flex flex-col gap-1.5">
                {summary.memory.map((m) => (
                  <li key={m} className="flex items-start gap-2 lyra-body-md text-lyra-fg-default">
                    <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-lyra-accent-purple-strong" aria-hidden="true" />
                    {m}
                  </li>
                ))}
              </ul>
              <div className="mt-2 flex items-center justify-between lyra-body-sm-emphasis text-lyra-fg-secondary">
                <span>{summary.sentimentLabel}</span>
                <span className="text-lyra-fg-default">{summary.sentimentValue}</span>
              </div>
              <div className="flex gap-2" aria-hidden="true">
                {[1, 2, 3, 4, 5].map((n) => (
                  <span
                    key={n}
                    className={cn(
                      "h-1.5 flex-1 rounded-full",
                      n <= summary.sentimentLevel ? "bg-lyra-status-warning-strong" : "bg-lyra-accent-purple-soft"
                    )}
                  />
                ))}
              </div>
            </div>
            )}
          </div>
          </div>
          </div>
          )}
        </div>
    </AICard>
  );
}

/** Standalone "Approval request" accordion (blue header, Copilot summary) for flows that bring their own decision UI
 *  (Marcus Webb). Whether a key's first reveal has played is the workspace UI store's (`revealedApprovals`), keyed
 *  by what the caller passes (Marcus: his case), not a module-scope set shared across cards and providers. */
export function ApprovalRequestAccordion({
  summary,
  timestamp,
  footer,
  onLink,
  revealKey,
  revealDelayMs = 0,
}: {
  /** With `revealDelayMs`: the card slides in this long after mount (first time only per key), e.g. after the autosummary. */
  revealKey?: string;
  revealDelayMs?: number;
  summary: TranscriptApprovalSummary;
  timestamp: string;
  footer?: React.ReactNode;
  onLink?: (key: string) => void;
}) {
  const message = { id: "approval-request", summary, timestamp } as unknown as TranscriptMessage;
  const [revealed, setRevealed] = useWorkspaceUiField("revealedApprovals");
  // First time only per key: the card isn't in the page at all until the delay passes, then it is added like any new
  // comment (fades in, and the transcript's own auto-scroll follows it down). Later mounts render immediately.
  const [animate] = useState(() => !!revealKey && revealDelayMs > 0 && !revealed.has(revealKey));
  const [visible, setVisible] = useState(!animate);
  useEffect(() => {
    if (visible) {
      if (revealKey) setRevealed((current) => (current.has(revealKey) ? current : new Set([...current, revealKey])));
      return;
    }
    const t = window.setTimeout(() => setVisible(true), revealDelayMs);
    return () => window.clearTimeout(t);
  }, [visible, revealDelayMs, revealKey, setRevealed]);
  if (!visible) return null;
  return (
    <div
      className={animate ? "animate-in fade-in-0 slide-in-from-bottom-2 duration-300" : undefined}
    >
      <ApprovalSummaryAccordion message={message} onLink={onLink} footer={footer} />
    </div>
  );
}

/** Collapses its children (fade + slide up + height to 0) when `hidden`, the reverse of the entrance animation. `gap` cancels the parent's flex gap while collapsed. */
export function AiActionCollapse({ hidden, gap, children }: { hidden?: boolean; gap?: boolean; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "grid transition-[grid-template-rows,opacity,transform,margin] duration-200 ease-in-out",
        hidden ? "pointer-events-none grid-rows-[0fr] -translate-y-2 opacity-0" : "grid-rows-[1fr] opacity-100",
        hidden && gap && "-mt-5"
      )}
      aria-hidden={hidden}
    >
      <div className="min-h-0 overflow-hidden">{children}</div>
    </div>
  );
}
