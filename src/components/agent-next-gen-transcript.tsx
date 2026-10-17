import { KnowledgeArticleSummaryRow } from "@/components/agent-next-gen-knowledge-article-card";
import { CopilotComposer } from "@/components/copilot-composer";
import { SaveAddressCard } from "@/contact-handling/SaveAddressCard";
import React, { useState, useRef, useLayoutEffect, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import {
  AICard,
  Link,
  AccordionHeadless,
  AccordionHeadlessItem,
  AccordionHeadlessContent,
  Avatar,
  ContactOverview,
  type ContactOverviewInfo,
  ChatMessage,
  ActionIconButton,
  InlineNotification,
  TagPicker,
  Tag,
  Button,
  Label,
  Textarea,
  ToggleGroup,
  Spinner,
  Interstitial,
  Switch,
  Badge,
  QuickReplyVariableForm,
  QuickReplyMenu,
  type ChannelType,
  type QuickReplyField,
  type QuickReplyMenuItem,
  type ChannelDirection,
} from "@nicecxone/lyra-ui";
import {
  Copy,
  ChevronDown,
  ArrowDown,
  Paperclip,
  Bold,
  Italic,
  Smile,
  Zap,
  FileText,
  Send,
  Bot,
  Sparkles,
  MessageSquareText,
  UserCheck,
  CheckCircle2,
  AlertCircle,
  History,
} from "lucide-react";
import {
  initialsFor,
  quickReplyFieldDisplayValue,
} from "@/components/agent-next-gen-shared-utils";
import { isAiActionMessage } from "@/components/agent-next-gen-ai-messages";
import { useCapability } from "@/provider-context";
import { useSetting } from "@/settings";

/* ── Transcript + Composer ──
   Split out of AgentNextGenPage.tsx (which had grown past Babel's 500KB
   code-generator threshold — see that file's own top-of-file note): every
   message-bubble/session/transcript/composer piece that renders an
   interaction's actual conversation, plus the mock session/message data
   that seeds it. Genuinely self-contained — per a dependency-graph script
   run before the split, nothing here references any OTHER
   AgentNextGenPage-specific type/component/mock-data by name (only
   `agent-next-gen-shared-utils.ts`'s pure helpers) — so this file sits at
   the same "no incoming feature-file dependencies" tier as that one, just
   one level up. `AgentNextGenPage` itself imports `InteractionTranscript`/
   `InteractionComposer` (the two real render entry points) plus a handful
   of types/constants (`TranscriptMessage`, `OUTCOME_TAG_OPTIONS`, etc.)
   still referenced from its own outcome-popover/notification code. */

// P-EXTRACT: the view-model types and the fixed option lists / mock
// sessions live in ./transcript/ now; re-exported here for existing importers.
import type {
  ApprovalDecisionDef,
  TranscriptApprovalSummary,
  TranscriptMessage,
  TranscriptSession,
  TranscriptSessionFingerprint,
  TranscriptTag,
} from "@/components/transcript/transcript-types";
import {
  OUTCOME_DEFAULT_SUMMARY,
  OUTCOME_DISPOSITION_OPTIONS,
  OUTCOME_TAG_OPTIONS,
  TRANSCRIPT_SESSION_FINGERPRINT,
  TRANSCRIPT_SESSION_FINGERPRINT_EMAIL,
  TRANSCRIPT_SESSION_FINGERPRINT_VOICE,
  TRANSCRIPT_SESSION_STATUS_OPTIONS,
  TRANSCRIPT_SESSION_STATUS_VARIANT,
  TRANSCRIPT_SESSIONS,
  TRANSCRIPT_SESSIONS_EMAIL,
  TRANSCRIPT_SESSIONS_VOICE,
} from "@/components/transcript/transcript-fixtures";
export type { TranscriptApprovalSummary, TranscriptMessage, TranscriptSession, TranscriptSessionFingerprint, TranscriptTag };
export {
  OUTCOME_DEFAULT_SUMMARY,
  OUTCOME_DISPOSITION_OPTIONS,
  OUTCOME_TAG_OPTIONS,
  TRANSCRIPT_SESSION_FINGERPRINT,
  TRANSCRIPT_SESSION_FINGERPRINT_EMAIL,
  TRANSCRIPT_SESSION_FINGERPRINT_VOICE,
  TRANSCRIPT_SESSION_STATUS_OPTIONS,
  TRANSCRIPT_SESSION_STATUS_VARIANT,
  TRANSCRIPT_SESSIONS,
  TRANSCRIPT_SESSIONS_EMAIL,
  TRANSCRIPT_SESSIONS_VOICE,
};

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

/** Standalone "Approval request" accordion (blue header, Copilot summary) for flows that bring their own decision UI (Marcus Webb). */
const revealedApprovalRequests = new Set<string>();
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
  // First time only per key: the card isn't in the page at all until the delay passes, then it is added like any new
  // comment (fades in, and the transcript's own auto-scroll follows it down). Later mounts render immediately.
  const [animate] = useState(() => !!revealKey && revealDelayMs > 0 && !revealedApprovalRequests.has(revealKey));
  const [visible, setVisible] = useState(!animate);
  useEffect(() => {
    if (visible) {
      if (revealKey) revealedApprovalRequests.add(revealKey);
      return;
    }
    const t = window.setTimeout(() => setVisible(true), revealDelayMs);
    return () => window.clearTimeout(t);
  }, [visible, revealDelayMs, revealKey]);
  if (!visible) return null;
  return (
    <div
      className={animate ? "animate-in fade-in-0 slide-in-from-bottom-2 duration-300" : undefined}
    >
      <ApprovalSummaryAccordion message={message} onLink={onLink} footer={footer} />
    </div>
  );
}

// Quick-add options offered from a message's hover "Tags" action — matches
// the app's real tag vocabulary (Complain/Help/Praise/Share/Billing), not
// an invented set, so a picked tag reads the same as the one seeded on m4.
// "Billing" (topic label, not sentiment) reuses the same neutral `default`
// variant "Share" already established for a non-sentiment tag. Deliberately
// not purple/teal/pink — CONTRIBUTING.md reserves those three Tag variants
// for channel-type coloring specifically.
// Canned replies drawn from for the simulated customer response
// `handleSendMessage` schedules after the agent sends a message — this demo
// has no real customer on the other end, so a short, generic pool stands in
// for one, same "randomly draw from a fixed pool" pattern already used for
// synthesized Customer Information data (`CUSTOMER_LATEST_NOTE_POOL`, etc.).
export const CUSTOMER_AUTO_REPLY_POOL = [
  "Thanks, got it!",
  "Okay, that makes sense.",
  "Appreciate the quick response.",
  "Got it, thank you!",
  "Sounds good, thanks for the help.",
  "Perfect, that answers my question.",
];

/** Per explicit request ("when that quick reply is typed make sure Marcus
 *  responds with 'That's great! Thanks for the quick reply'"), the
 *  "Acknowledge" quick reply (`QUICK_REPLIES` above) gets its own scripted
 *  simulated-customer response instead of a random `CUSTOMER_AUTO_REPLY_POOL`
 *  pick — reads as a direct reaction to the agent's specific message rather
 *  than a generic one. Not actually Marcus-specific (the request's own
 *  screenshot just happened to be an interaction with a customer named
 *  Marcus Webb) — this applies to every simulated customer reply, in every
 *  interaction, on every tier, exactly like `CUSTOMER_AUTO_REPLY_POOL`
 *  itself already does. */
export const ACKNOWLEDGE_QUICK_REPLY_RESPONSE = "That's great! Thanks for the quick reply";

/** Resolves the canned simulated-customer reply text for a given
 *  `handleSendMessage` call — the single place all 3 tiers' own
 *  `window.setTimeout` simulated-reply callbacks should call instead of
 *  reading `CUSTOMER_AUTO_REPLY_POOL` directly, so the "Acknowledge" special
 *  case (and any future one like it) only needs to be taught here once. */
export function resolveCustomerAutoReply(agentMessageText: string): string {
  const acknowledgeTemplate = QUICK_REPLIES.find((reply) => reply.id === "acknowledge")?.template;
  if (acknowledgeTemplate && agentMessageText === acknowledgeTemplate) {
    return ACKNOWLEDGE_QUICK_REPLY_RESPONSE;
  }
  return CUSTOMER_AUTO_REPLY_POOL[Math.floor(Math.random() * CUSTOMER_AUTO_REPLY_POOL.length)];
}

// Expanded to 25 (per explicit request, to actually exercise TagPicker's
// scrollable checkbox list rather than a 5-row set that never needed to
// scroll) — a realistic support-conversation tag vocabulary, not filler:
// sentiment/feedback tags (Complain/Praise/...), the common request
// categories an agent would tag a message with (Billing/Refund/
// Cancellation/...), and a few urgency/risk markers (Escalation/Fraud
// Alert/Churn Risk). Still only `default`/`success`/`warning`/`critical`/
// `info`/`neutral` variants — see this file's own note above reserving
// `purple`/`teal`/`pink` for channel-type coloring.
export const QUICK_TAG_OPTIONS: Omit<TranscriptTag, "id">[] = [
  { label: "Complain", variant: "critical" },
  { label: "Help", variant: "info" },
  { label: "Praise", variant: "success" },
  { label: "Share", variant: "default" },
  { label: "Billing", variant: "default" },
  { label: "Refund", variant: "warning" },
  { label: "Cancellation", variant: "critical" },
  { label: "Escalation", variant: "critical" },
  { label: "Follow-Up", variant: "info" },
  { label: "Feedback", variant: "neutral" },
  { label: "Bug Report", variant: "critical" },
  { label: "Feature Request", variant: "info" },
  { label: "Shipping", variant: "default" },
  { label: "Delivery Delay", variant: "warning" },
  { label: "Password Reset", variant: "info" },
  { label: "Account Access", variant: "warning" },
  { label: "Upgrade", variant: "success" },
  { label: "Downgrade", variant: "neutral" },
  { label: "Fraud Alert", variant: "critical" },
  { label: "Payment Failed", variant: "critical" },
  { label: "Subscription", variant: "default" },
  { label: "Warranty", variant: "neutral" },
  { label: "Return", variant: "warning" },
  { label: "Exchange", variant: "default" },
  { label: "Technical Issue", variant: "info" },
];

/* ── TranscriptMessageBubble ──
   One customer/agent bubble, extracted out of the old flat-list
   `InteractionTranscript` so it can be looped once per `Contact`
   instead of once for the whole (now session-grouped) transcript. Tag
   add/remove and the copy action are still owned by `InteractionTranscript`
   (tag state lives per-session there) — this component is just a thin
   wrapper over lyra-ui's own `ChatMessage`, taking the handlers/state
   `InteractionTranscript` already owns and threading them straight
   through. `ChatMessage` now owns the actual bubble/toolbar/tags markup
   (ported from what used to be hand-rolled directly in this function —
   the two were kept in sync by hand for a while, this replaces that with
   a real shared component) — see that component's own doc comment
   (chat-message.tsx, lyra-ui) for the one deliberate layout change it
   made along the way: the timestamp now sits before the name in the
   header row ("9:51 AM · John Smith") instead of its own line inside the
   bubble. This wrapper's own external prop shape is unchanged, so every
   existing call site below needed zero changes. */
export function TranscriptMessageBubble({
  message,
  customerIdentified = true,
  tagPickerOpen,
  onTagPickerOpenChange,
  onAddTag,
  onRemoveTag,
  onClearTags,
  onCopy,
  narrow = false,
}: {
  message: TranscriptMessage;
  /** See `ChatMessage`'s own `identified` prop doc comment (lyra-ui) — only
   *  ever matters when `message.sender === "customer"`, ignored otherwise.
   *  Defaults to identified so every call site that doesn't distinguish the
   *  two cases (every one, before this prop existed) keeps showing
   *  `message.initials` exactly as before. */
  customerIdentified?: boolean;
  tagPickerOpen: boolean;
  onTagPickerOpenChange: (open: boolean) => void;
  onAddTag: (option: Omit<TranscriptTag, "id">) => void;
  onRemoveTag: (tagId: string) => void;
  onClearTags: () => void;
  onCopy: () => void;
  /** True below 400px of the transcript's own rendered width — see
   *  `InteractionTranscript`'s own `transcriptNarrow` state (its
   *  `ResizeObserver`) for how this is measured. Drops the sender avatar
   *  only — the bubble's own max-width (80%, full below 768px) is a
   *  SEPARATE breakpoint `ChatMessage` measures and applies entirely on
   *  its own (see that component's own doc comment, lyra-ui), not
   *  something this prop controls. */
  narrow?: boolean;
}) {
  return (
    <ChatMessage
      variant={message.sender}
      ai={message.sender === "agent" && message.initials === "AI"}
      name={message.name}
      initials={message.initials}
      identified={customerIdentified}
      timestamp={message.timestamp}
      text={message.text}
      narrow={narrow}
      onCopy={onCopy}
      tagOptions={QUICK_TAG_OPTIONS}
      tags={message.tags}
      tagPickerOpen={tagPickerOpen}
      onTagPickerOpenChange={onTagPickerOpenChange}
      onAddTag={onAddTag}
      onRemoveTag={onRemoveTag}
      onClearTags={onClearTags}
    />
  );
}

/* ── TranscriptPlainLine ──
 *  Per explicit request ("style the transcript like the contact history
 *  call transcripts"): a plain "Name  timestamp" header line (bold name,
 *  secondary-colored time) with the spoken line below it, stacked top-to-
 *  bottom for every turn regardless of speaker — deliberately NOT
 *  `TranscriptMessageBubble`'s avatar/bubble/left-right `ChatMessage`
 *  layout. This is the live-transcript twin of `agent-next-gen-contact-
 *  history.tsx`'s own `ContactHistoryTranscriptLine` (same reference
 *  screenshot, same look), kept as a separate small component rather than
 *  reusing that one directly since it works over `ContactHistoryMessage`
 *  or (its own hardcoded `CURRENT_AGENT_NAME` for every agent turn), while
 *  a live `TranscriptMessage` already carries the real speaker `name` for
 *  both sides (a customer, or here also a non-human speaker like a
 *  "Cognigy AI Agent") — this one just renders whatever `name` it's
 *  given, no agent-identity substitution. Used in place of
 *  `TranscriptMessageBubble` only for voice channels (see this file's own
 *  `renderPlainLine`/`renderBubble` selection below) — chat/sms/whatsapp
 *  keep the bubble layout exactly as before. */
function TranscriptPlainLine({ name, timestamp, text }: { name: string; timestamp: string; text: string }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline gap-2">
        <span className="lyra-body-md-emphasis text-lyra-fg-default">{name}</span>
        <span className="lyra-body-sm text-lyra-fg-secondary">{timestamp}</span>
      </div>
      <p className="lyra-body-md text-lyra-fg-default">{text}</p>
    </div>
  );
}

/** "Customer is typing" bubble — shown in place of the next message while a
 *  simulated customer reply is pending (chat/SMS/WhatsApp only, per explicit
 *  request; see `InteractionTranscript`'s own `isCustomerTyping` doc comment
 *  for how the caller derives/times this). Deliberately built off
 *  `TranscriptMessageBubble`'s own customer-side markup rather than a new
 *  one-off shape — same avatar sizing/color (`bg-lyra-accent-green-soft`/
 *  `text-lyra-accent-green-strong`), same `rounded-lyra-lg ... rounded-tl-
 *  none bg-lyra-state-hover` bubble a real customer message renders in — so
 *  the indicator reads as "the next one of these bubbles is on its way," not
 *  a differently-styled system notice. `displayInitials` — the same real-
 *  customer-name substitution `InteractionTranscript` already applies to
 *  every actual customer message (see that component's own doc comment) —
 *  is threaded in here too, so the indicator's avatar matches whichever
 *  initials the customer's real messages are showing, not the hardcoded
 *  mock "C" placeholder. Same for `identified` — an unidentified customer's
 *  real message bubbles show a generic person icon instead of `initials`
 *  (see `ChatMessage`'s own `identified` doc comment, lyra-ui); this
 *  indicator matches that too, rather than flashing a stray initial for one
 *  frame right before the real bubble it stands in for replaces it.
 *  Three dots, `animate-bounce` (Tailwind's stock keyframe) with a staggered
 *  `animationDelay` per dot (0ms/150ms/300ms) — the standard "typing"
 *  cadence, rather than a bespoke keyframe just for this one usage. */
function TypingIndicator({
  initials,
  identified = true,
  narrow = false,
  bubbleFullWidth = false,
  ai = false,
}: {
  /** AI agent is typing — right-aligned, purple, same look as an AI message bubble. */
  ai?: boolean;
  initials: string;
  identified?: boolean;
  narrow?: boolean;
  /** True below 768px of the transcript's own rendered width — matches the
   *  real message bubbles' own independent max-width breakpoint (see
   *  `ChatMessage`'s own doc comment, lyra-ui) so this bubble doesn't read
   *  as a different width than whichever real one follows it. A separate
   *  prop from `narrow` (400px, avatar only) — see
   *  `InteractionTranscript`'s own `transcriptBubbleFullWidth` state for
   *  how this is measured. */
  bubbleFullWidth?: boolean;
}) {
  if (ai) {
    return (
      <div className="flex flex-col items-start" aria-live="polite" aria-label="AI agent is typing">
        <div className={cn("flex items-start gap-2", bubbleFullWidth ? "max-w-full" : "max-w-[80%]")}>
          {!narrow && <Avatar icon={Bot} size="xs" className="bg-lyra-bg-accent text-lyra-fg-on-accent" />}
          <div className="rounded-lyra-lg rounded-tl-none border border-transparent bg-lyra-accent-purple-soft px-4 py-3.5">
            <div className="flex items-center gap-1">
              {[0, 150, 300].map((delayMs) => (
                <span
                  key={delayMs}
                  className="block h-1.5 w-1.5 animate-bounce rounded-full bg-lyra-accent-purple-strong"
                  style={{ animationDelay: `${delayMs}ms` }}
                  aria-hidden="true"
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-start" aria-live="polite" aria-label="Customer is typing">
      <div className={cn("flex items-start gap-2", bubbleFullWidth ? "max-w-full" : "max-w-[80%]")}>
        {!narrow && (
          // Per explicit follow-up request ("extend avatar size/color to
          // cover those"): now built on lyra-ui's shared `Avatar`
          // (avatar.tsx, `color="customer"`/`size="xs"` added for exactly
          // this chat-bubble shape) instead of this hand-rolled span —
          // same green tone, same 28px circle, same `identified ?
          // initials : genericIcon` split, just the shared component now.
          <Avatar initials={identified ? initials : undefined} color="customer" size="xs" />
        )}
        <div className="flex min-w-0 flex-col gap-1">
          <div className="rounded-lyra-lg rounded-tl-none border border-transparent bg-lyra-state-hover px-4 py-3.5">
            <div className="flex items-center gap-1">
              {[0, 150, 300].map((delayMs) => (
                <span
                  key={delayMs}
                  className="block h-1.5 w-1.5 animate-bounce rounded-full bg-lyra-fg-secondary"
                  style={{ animationDelay: `${delayMs}ms` }}
                  aria-hidden="true"
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import { deriveTranscriptSessions, sessionStatusOf } from "@/components/transcript/transcript-sessions";
// P-EXTRACT: the session row lives in ./transcript/session-row/ now.
import { ChannelStatusTag, TransferIcon, TranscriptSessionDetails } from "@/components/transcript/session-row/session-row-parts";
import { TranscriptSessionSeparator } from "@/components/transcript/session-row/TranscriptSessionSeparator";
export { ChannelStatusTag, TransferIcon, TranscriptSessionDetails, TranscriptSessionSeparator };


// `ContactOverview` and its `ContactOverviewInfo` type used to live here as
// a bespoke, hand-rolled block — promoted to lyra-ui (see this file's own
// import from "@nicecxone/lyra-ui" above) per explicit request, both so
// other consumers get the same component and so its expand/collapse gets a
// real height animation (built on the same Radix accordion primitive/
// `accordion-down`/`accordion-up` keyframes every other accordion in that
// package already uses) instead of this file's old plain conditional
// render. See that component's own doc comment (lyra-ui's
// contact-overview.tsx) for the full reasoning.

export function InteractionTranscript({
  channelType,
  direction,
  customerName,
  customerIdentified = true,
  hideMockFollowUpMessages = false,
  hideAllMessages = false,
  sessionRowOnly = false,
  hideCurrentSessionRow = false,
  contactId,
  channelAddressLabel,
  skillLabel,
  isFreshLaunch,
  contactOverview: contactOverviewIn,
  overview: overviewIn,
  hideAiActions = false,
  contactOverviewPosition,
  onViewCustomerInfo,
  onViewInteractionHistory,
  onLaunchPreviousAgentInteraction,
  reopenedContacts,
  liveMessages: liveMessagesIn,
  currentStatus,
  onCurrentStatusChange,
  outcomeOpen,
  onOutcomeOpenChange,
  outcomeTags,
  onOutcomeTagsChange,
  outcomeDispositionCode,
  onOutcomeDispositionChange,
  outcomeSummary,
  onOutcomeSummaryChange,
  onOutcomeSave,
  onOutcomeCancel,
  outcomeCallEnded,
  outcomeShowSaveAndRedial,
  onOutcomeSaveAndRedial,
  onOutcomeSaveAndDismiss,
  onDismissChannel,
  dimmed,
  showSessionActionCluster = true,
  showSessionConsultTransferAndAddParticipant = true,
  showSessionKebabMenu = true,
  sessionOutcomeAfterStatus = false,
  showSessionAddParticipant = true,
  sessionTransferInKebabMenu = false,
  sessionStatusAndKebabBeforeOutcome = false,
  sessionControlsReadOnly = false,
  showSessionStatus: showSessionStatusProp,
  trailingContent,
  trailingContentKey,
  isNewThread = false,
  isCustomerTyping = false,
  isAiTyping = false,
  onApprovalDecision,
  onApprovalCallRequest,
  onApprovalSuggestionAsk,
  approvalTakenOver,
  activeSnapshotLink,
  onWrapUpComplete,
  onSnapshotLink,
  onViewSessionDetails,
  onToggleDetailsPanel,
  detailsPanelOpen = false,
  detailsPanelPreviewContent,
  detailsPanelPreviewOpen = false,
  onDetailsPanelPreviewHoverStart,
  onDetailsPanelPreviewHoverEnd,
  showViewDetails = true,
  viewDetailsLabel = "View Details",
  sessionRowPortalTarget,
  hideSessionSeparatorFade = false,
}: {
  /** Which channel's content to show — see this component's own doc
   *  comment above. Undefined (no active interaction/channel yet) renders
   *  the same as SMS/WhatsApp. */
  channelType?: ChannelType;
  /** Inbound/outbound direction of the active channel (`Thread.direction`) —
   *  forwarded to each `TranscriptSessionSeparator`'s direction-aware
   *  voice/SMS icon. Undefined renders the plain, direction-less icon. */
  direction?: ChannelDirection;
  /** Real customer name to substitute for every customer-sender message's
   *  hardcoded mock name in the SMS/WhatsApp transcript — see this
   *  component's own doc comment above. (Also briefly shown at the far
   *  left of every `TranscriptSessionSeparator` row alongside the active
   *  channel's own address, gated on the Customer Information panel being
   *  closed — dropped from there for good once that panel permanently
   *  docked to the right of the page, as redundant with it; this
   *  message-substitution use is unaffected.) */
  customerName?: string;
  /** Whether `customerName` above is an actual identified customer, as
   *  opposed to a raw, unidentified address standing in for one (a dialed
   *  number, a typed email/SMS/WhatsApp handle with no directory match) —
   *  same distinction `InteractionNavItem`'s own `customerIdentified` prop
   *  makes for the compact LeftNav tile's avatar (see that prop's own doc
   *  comment, lyra-ui). Per explicit bug report, with a screenshot of a
   *  message bubble showing a bare "4" avatar for an unidentified SMS
   *  number: every customer-sender message bubble (`TranscriptMessageBubble`)
   *  and the "customer is typing" indicator both showed `initialsFor`'s own
   *  fallback — the address's first character — since neither had any way
   *  to know the difference between a real name and a raw address; this
   *  threads that same distinction down to `ChatMessage`'s own `identified`
   *  prop (lyra-ui) instead, which shows a generic person icon in that case.
   *  Defaults to identified so every existing caller (none of which
   *  distinguished the two cases before this prop existed) keeps showing
   *  initials exactly as before. */
  /** Drops the shared mock follow-up session's (session-2) messages — used by scripted scenarios (Lucas Thomas) whose own transcript shouldn't show them. */
  hideMockFollowUpMessages?: boolean;
  /** Hides every message bubble (mock history + live) — used while an AI-led chat is only being reviewed, before the agent takes over. */
  hideAllMessages?: boolean;
  /** Only the current session's row (status, Session Details, Outcome, the
   *  action cluster), no conversation and no scroller: AI display "main"
   *  (P-AIFIRST), where the thread itself is in the panel and the AI
   *  workspace fills the column below this row. */
  sessionRowOnly?: boolean;
  /** The conversation without the current session's row: the caller renders
   *  that row elsewhere (`sessionRowOnly`, the docked panel's header under AI
   *  display "main", P-AIFIRST (k5)). Earlier sessions keep their rows. */
  hideCurrentSessionRow?: boolean;
  customerIdentified?: boolean;
  /** The active channel's own BASE Contact id (`Thread.contactId`) — used
   *  as the synthetic "just launched" session's Contact ID (see
   *  `isFreshLaunch` below). Previously this reused the interaction's own
   *  CUSTOMER id instead (a real, shipped bug — Session Details' "Contact
   *  ID" field literally showed the Customer ID) — now a real, distinct
   *  per-Contact id, generated once at Thread-creation time. */
  contactId: string;
  /** Per explicit request ("display the number in the session row instead
   *  of the contact ID — display email/whatsapp handle/etc. for phase
   *  2"): the active channel's own human-readable reach address
   *  (`Thread.addressLabel` — already a generic "phone number/email
   *  address/WhatsApp handle" string covering every channel type) —
   *  becomes the synthetic "just launched"/reopened session's own
   *  `Contact.addressLabel` (see that field's own doc comment), which
   *  `TranscriptSessionSeparator` shows in place of "# contactId" once
   *  set. Undefined for a channel with no known address (an ad-hoc typed
   *  contact, a redialed call) — that session's row then falls back to
   *  the plain "# contactId" display, exactly as before this prop
   *  existed. */
  channelAddressLabel?: string;
  /** The active channel's own skill preview (`Thread.preview`), if
   *  any — shown as the synthetic "just launched" session's Skill field. */
  skillLabel?: string;
  /** True only for an interaction whose card was just created this session
   *  (`Interaction.startedFresh` — see its own doc comment) — shows a
   *  single empty "Session Details" separator (today's date, no messages)
   *  for Chat/SMS/WhatsApp instead of the fixed mock chat log, since a
   *  brand-new text conversation genuinely has no history yet. Has no
   *  effect for Voice/Email — those always show their own fixed session
   *  (with its own placeholder "Coming Soon" body) regardless, since
   *  there's no "pre-existing conversation" for either to wrongly show in
   *  the first place. */
  isFreshLaunch: boolean;
  /**
   * When set, renders a `ContactOverview` block (see that component's own
   * doc comment) right at the top of the CURRENT session's message
   * content — the caller resolves this (prior-agent lookup, snapshot
   * text) and only passes it for a freshly-launched contact with actual
   * context worth surfacing; omit it (or pass `undefined`) for a genuinely
   * first-ever, no-history contact, same channels/`isFreshLaunch` already
   * gates the empty "Session Details" separator with — this is a SEPARATE
   * flag, though, not derived from `isFreshLaunch` in here, since not
   * every fresh launch has prior-agent/snapshot context to show (a
   * brand-new customer with zero history anywhere has nothing for this to
   * summarize).
   */
  contactOverview?: ContactOverviewInfo;
  /** When true, only chat bubbles show: no autosummary/context overview, interstitials, approval summaries, events or wrap-up cards. */
  hideAiActions?: boolean;
  /**
   * The overview block, rendered where the transcript places its overview
   * (above the conversation, or where `contactOverviewPosition` says): the
   * caller supplies it — the AI overview (`AutosummaryCard`, and Marcus's
   * card) in the main column with AI display inline, the Autosummary alone
   * in a thread view. Takes priority over `contactOverview`.
   */
  overview?: React.ReactNode;
  /**
   * Overrides which of the two `ContactOverview` render spots is used —
   * see either spot's own doc comment below for what each means. Only
   * needed when a caller's own `isFreshLaunch` value doesn't actually
   * match which spot its `ContactOverview` should use: the Marcus Webb
   * scripted scenario (AgentWorkspace2WithDeskPage.tsx) sets
   * `isFreshLaunch` for its OTHER effect (the empty "Session Details"
   * separator a genuinely brand-new text conversation gets) even though
   * his first message arrives instantly/scripted rather than empty — per
   * explicit bug report, his Contact Overview still needs to land AFTER
   * that first message, i.e. the "bottom" spot, not the "top" one
   * `isFreshLaunch` would otherwise pick for him. Omit to fall back to
   * the default `isFreshLaunch ? "top" : "bottom"` every other caller
   * already gets.
   */
  contactOverviewPosition?: "top" | "bottom";
  /**
   * Forwarded straight through to the rendered `ContactOverview`'s own
   * `onViewCustomerInfo`/`onViewInteractionHistory` props (see either
   * one's own doc comment, contact-overview.tsx) — the caller (each page
   * file) opens its docked Customer Information panel and jumps it to the
   * Overview/Contacts tab respectively. `undefined` for either one hides
   * that specific link (same as `ContactOverview` itself does), which
   * naturally happens whenever `contactOverview` itself is unset too since
   * neither link means anything without a panel to jump.
   */
  onViewCustomerInfo?: () => void;
  onViewInteractionHistory?: () => void;
  /**
   * Forwarded straight through to the rendered `ContactOverview`'s own
   * `onLaunchPreviousAgentInteraction` prop (see its own doc comment,
   * contact-overview.tsx) — turns that block's "already been working with
   * Agent X" name/id into a clickable link that opens a Call/Chat popover.
   * `undefined` hides the link (same as `ContactOverview` itself does).
   */
  onLaunchPreviousAgentInteraction?: (channel: "voice" | "chat") => void;
  /**
   * One entry per time this channel was reopened (via "Add Channel") while
   * closed — `Interaction`'s own `Thread.reopenedContacts`,
   * passed straight through. Rendered as one additional, empty synthetic
   * "Session Details" separator per entry, appended AFTER whichever base
   * session list this channel type otherwise shows (see this component's
   * own doc comment above and the render return below) — see that field's
   * own doc comment for the full reasoning. Text channels
   * (chat/sms/whatsapp) only; always `undefined`/ignored for voice/email,
   * which have no equivalent multi-session concept (`isTextChannel` below
   * gates this the same way it gates `isFreshLaunch`). Each entry's own
   * `messagesBeforeReopen` is what lets `liveMessagesBySessionId` below
   * slice the flat `liveMessages` prop back into per-session chunks — see
   * that field's own doc comment (on `Thread.reopenedContacts`) for
   * the full boundary reasoning.
   */
  reopenedContacts?: { id: string; date: string; startTime: string; messagesBeforeReopen: number; contactId: string }[];
  /**
   * Messages actually sent this session (`InteractionComposer`'s Send
   * button) plus the simulated customer reply that follows — this
   * interaction's own `Interaction.liveMessages`, passed straight
   * through. Rendered after whatever the branches below otherwise show (the
   * fixed mock log, or nothing yet for a fresh SMS launch), in its own
   * trailing block — see the render return below. Tag state for these
   * messages (`liveMessageTags`) is kept separate from `sessionMessages`
   * (the mock log's own tag state) rather than merged into it: merging
   * would mean re-deriving a stable `sessionMessages` entry from a prop
   * that's a fresh `[]` reference on every render an interaction has no
   * live messages yet, which'd need an effect just to keep in sync for no
   * real benefit.
   */
  liveMessages: TranscriptMessage[];
  /**
   * The status last explicitly assigned (via the status popover) to the
   * ACTIVE channel's current/most-recent session — the caller resolves this
   * from `Interaction.threadStatuses[activeChannel.id]` (see that
   * field's own doc comment for why status has to be tracked per-channel,
   * up on `Interaction`, rather than purely in this component's own
   * state) and passes the single resolved value straight through. Only ever
   * applies to the LAST entry in `sessionsToRender` below (the "current"
   * session — the freshly-launched synthetic one, the shared mock log's
   * follow-up session, or Voice/Email's single session); every earlier/
   * historical session always reads "Closed" instead, unconditionally —
   * see `getSessionStatus`'s own doc comment.
   */
  currentStatus?: string;
  /** Fires whenever the agent changes the CURRENT session's status via the
   *  popover (a plain pick, or confirming "Close") — the caller writes this
   *  back onto the active channel's own entry in `Interaction.
   *  threadStatuses` (`handleInteractionStatusChange`, main component).
   *  Never fires for any other (historical) session — those are always
   *  locked/uneditable now (see `TranscriptSessionSeparator`'s own
   *  `isCurrentSession` doc comment), so there's nothing else to change. */
  onCurrentStatusChange: (status: string) => void;
  /**
   * Real Consult/Transfer + Outcome buttons on the CURRENT session's own
   * separator bar (`TranscriptSessionSeparator`, floated right per explicit
   * request) — all of these are the exact same shared `outcomeDraftKey`/
   * `outcomeDraft` state (main component) the LeftNav's `ChannelRow`
   * Outcome button already uses for THIS channel, threaded down as plain
   * values/setters rather than one bundled object so this component (which
   * has no other reason to know about `ChannelOutcomeConfig`'s shape) only
   * takes on the individual pieces it actually forwards. All optional and
   * only meaningfully passed together — see the render-call site
   * (`showPanelToggle` gates whether Customer Information / outcome state
   * exists at all in this app). `resolution`/`onResolutionChange` aren't
   * separate props here since they're just `currentStatus`/
   * `onCurrentStatusChange` above (one underlying value, same as the
   * LeftNav's own outcome wiring).
   */
  outcomeOpen?: boolean;
  onOutcomeOpenChange?: (open: boolean) => void;
  outcomeTags?: string[];
  onOutcomeTagsChange?: (tags: string[]) => void;
  outcomeDispositionCode?: string;
  onOutcomeDispositionChange?: (value: string) => void;
  outcomeSummary?: string;
  onOutcomeSummaryChange?: (value: string) => void;
  onOutcomeSave?: () => void;
  onOutcomeCancel?: () => void;
  /** True once this channel's call has ended (voice only) — swaps the
   *  Outcome popover's footer to "Save & Redial"/"Save & Dismiss" instead
   *  of "Cancel"/"Save & Close" (`ChannelOutcomeConfig.callEnded`,
   *  outcome-panel.tsx). Unset/false leaves it exactly as today. */
  outcomeCallEnded?: boolean;
  /** Whether that footer shows "Save & Redial" (Settings → Outbound Calling); default true. */
  outcomeShowSaveAndRedial?: boolean;
  /** "Save & Redial" clicked — only meaningful while `outcomeCallEnded` is
   *  true. Called with the Outcome trigger's own DOM node (`OutcomePanel`
   *  threads this through automatically — see its own doc comment,
   *  outcome-panel.tsx) so the caller can anchor the resulting redial
   *  popover right on this row's Outcome button. */
  onOutcomeSaveAndRedial?: (anchorEl: HTMLElement | null) => void;
  /** "Save & Dismiss" clicked — only meaningful while `outcomeCallEnded`
   *  is true. */
  onOutcomeSaveAndDismiss?: () => void;
  /**
   * Real "Unassign & Dismiss" button on the CURRENT session's own separator
   * bar, immediately right of the status tag — per explicit request. Same
   * scoping as the `outcome*` props above: only meaningful for the CURRENT
   * session (the caller only ever passes this alongside a defined
   * `outcomeOpen`, mirroring that gate at the render-call site below),
   * since a historical/closed session has no live channel left to dismiss.
   * The caller wires this to the exact same `handleDismissChannel`/
   * `handleDismissInteraction` pair the LeftNav's `ChannelTab` kebab's own
   * "Unassign & Dismiss" entry already uses for this channel — same icon
   * (`UserX`), same action, just a second real trigger for it.
   */
  onDismissChannel?: () => void;
  /**
   * True once this whole conversation reads as over/read-only — either
   * `Interaction.closed` (a reopened, fully-closed historical
   * interaction) or the ACTIVE channel's own `channelStatuses` entry
   * reading `"Closed"` (still an otherwise-open assignment, just this one
   * channel closed via the status popover) — the same union of conditions
   * that already gate the "You are viewing a closed interaction."/"This
   * channel is closed." banners at the render call site, reused here
   * rather than re-derived from `currentStatus` alone so this fades for
   * BOTH closed states those two banners cover, not just one of them. Per
   * explicit request, fades every session's messages (not just the
   * current one) to 50% opacity — the whole conversation is inert now, not
   * just its most recent stretch. */
  dimmed?: boolean;
  /** Per explicit request (Agent Workspace 2.0 only): once
   *  `AgentNextGenPage.tsx`'s own record header grew an icon-button cluster
   *  covering these same per-session actions (plus a relocated status
   *  chip), passed straight through to every `TranscriptSessionSeparator`
   *  below as `showActionCluster` — see that prop's own doc comment.
   *  Defaults `true` (every other call site keeps the session row's own
   *  copy). */
  showSessionActionCluster?: boolean;
  /** Passed straight through to every `TranscriptSessionSeparator` below as
   *  `showConsultTransferAndAddParticipant` — see that prop's own doc
   *  comment. Default `true` (every other call site keeps both buttons). */
  showSessionConsultTransferAndAddParticipant?: boolean;
  /** Passed straight through to every `TranscriptSessionSeparator` below as
   *  `showKebabMenu` — see that prop's own doc comment. Default `true`
   *  (every other call site keeps the kebab). */
  showSessionKebabMenu?: boolean;
  /** Passed straight through to every `TranscriptSessionSeparator` below as
   *  `outcomeAfterStatus` — see that prop's own doc comment. Default
   *  `false` (every other call site keeps Outcome in its original
   *  position). */
  sessionOutcomeAfterStatus?: boolean;
  /** Passed straight through to every `TranscriptSessionSeparator` below as
   *  `showAddParticipant` — see that prop's own doc comment. Default `true`
   *  (every other call site keeps Add Participant). */
  showSessionAddParticipant?: boolean;
  /** Passed straight through to every `TranscriptSessionSeparator` below as
   *  `transferInKebabMenu` — see that prop's own doc comment. Default
   *  `false` (every other call site keeps Transfer as its own standalone
   *  icon). */
  sessionTransferInKebabMenu?: boolean;
  /** Passed straight through to every `TranscriptSessionSeparator` below as
   *  `statusAndKebabBeforeOutcome` — see that prop's own doc comment.
   *  Default `false` (every other call site keeps this cluster in its
   *  original DOM order). */
  sessionStatusAndKebabBeforeOutcome?: boolean;
  /** Passed straight through to every `TranscriptSessionSeparator` below as
   *  `controlsReadOnly` — see that prop's own doc comment. Default `false`
   *  (every other call site is unaffected). */
  sessionControlsReadOnly?: boolean;
  /** Passed to every `TranscriptSessionSeparator` as `showStatus`. Defaults
   *  to whether the provider stores case status (hide, don't disable). */
  showSessionStatus?: boolean;
  /** Rendered as the last item inside the scrolling content, after the
   *  conversation and Autosummary, so it scrolls with them (the voice
   *  wrap-up card, P0.5d.1). */
  trailingContent?: React.ReactNode;
  /** Identifies `trailingContent`: it scrolls into view (smoothly) the first
   *  time each key appears in this transcript, then never again. */
  trailingContentKey?: string;
  /** True for a brand-new, agent-initiated OUTBOUND thread with no real
   *  activity yet — the caller resolves this the same way as
   *  `isFreshLaunch` (`Interaction.startedFresh`), AND-ed with "the
   *  customer hasn't replied yet" (`Thread.lastCustomerMessageTick`) —
   *  same compound "still genuinely fresh, not just started-outbound"
   *  check `copilotAvailable` already uses (main component) — rather than
   *  reusing `isFreshLaunch` alone, since that flag stays `true` for the
   *  rest of the interaction's life even once real activity exists (it
   *  only controls whether the mock session log is skipped). Passed
   *  straight through to the CURRENT session's own
   *  `TranscriptSessionSeparator` as `isNewThread` — see that prop's own
   *  doc comment for the full reasoning/scoping. Defaults `false`; every
   *  existing call site is unaffected until the caller starts computing a
   *  real value. */
  isNewThread?: boolean;
  /** True while a simulated customer reply is pending on the ACTIVE channel
   *  (`handleSendMessage`'s 2.5s reply timeout, main component — set the
   *  instant the agent's own message is sent, cleared the moment the
   *  customer's reply actually lands) — renders a `TypingIndicator` bubble
   *  right after the live-message list of the CURRENT session (same
   *  `lastSessionId` scoping `outcomeOpen`/`showSessionActionCluster` use
   *  above; a typing indicator only ever makes sense for whichever
   *  conversation is actually live). Per explicit request, only meaningful
   *  for `isTextChannel` (chat/SMS/WhatsApp) — Voice has no message concept
   *  to "type," and Email's reply cadence isn't a live back-and-forth the
   *  way the other three are; the render check below gates on both. Defaults
   *  `false`; every existing call site is unaffected until the caller starts
   *  computing a real value. */
  isCustomerTyping?: boolean;
  /** Shows the AI agent's (purple, right-aligned) typing bubble at the end of the current session. */
  isAiTyping?: boolean;
  /** Fired when the agent picks a decision on an approval summary card — the caller plays out the follow-up in the chat. */
  onApprovalDecision?: (value: string, note: string) => void;
  /** Fired when a `callRequest` decision is picked — see `TranscriptApprovalSummary.decisions[].callRequest`. */
  onApprovalCallRequest?: (req: { value: string; anchorEl: HTMLElement; confirm: () => void }) => void;
  onApprovalSuggestionAsk?: (text: string) => void;
  /** The agent took over before deciding on the approval card. */
  approvalTakenOver?: boolean;
  /** The link key whose panel is currently open (marks the matching instruction row active). */
  activeSnapshotLink?: string;
  /** Fired when the agent clicks "Complete wrap-up" on a wrap-up card. */
  onWrapUpComplete?: () => void;
  /** Snapshot bullet links (`[label](key)`) in the inline Contact Overview — called with the key. */
  onSnapshotLink?: (key: string) => void;
  /** Fires when "View Details" is clicked on any session row (each
   *  `TranscriptSessionSeparator`'s own `onViewDetails`, per explicit
   *  request that it stop expanding `TranscriptSessionDetails` inline and
   *  open an external panel instead) — passed the specific `Contact`
   *  session that was clicked. The caller (each tier page) opens a
   *  "Session Details" `InteriorPanel` for it; for a VOICE channel
   *  specifically, per that same request, the caller instead switches its
   *  existing "Transcript" panel to a "Details" tab showing this session
   *  rather than opening a second, separate panel — this component has no
   *  opinion on which; it just reports the click with the session in
   *  question. Omit for a caller with no panel to open (nothing renders
   *  differently here either way — the row's own `open`/collapse state is
   *  gone, so there's no fallback in-place behavior to fall back to). */
  onViewSessionDetails?: (session: TranscriptSession) => void;
  /** Forwarded straight through to every `TranscriptSessionSeparator`'s own
   *  `onToggleDetailsPanel` (see that prop's own doc comment for the full
   *  "why" — a plain open/close toggle now, no menu, no per-session
   *  content). Omit for a caller with no Details panel to toggle (nothing
   *  else renders differently either way). */
  onToggleDetailsPanel?: () => void;
  /** Forwarded straight through to every `TranscriptSessionSeparator`'s own
   *  `detailsPanelOpen` (see that prop's own doc comment for the full
   *  "why" — hides the `onToggleDetailsPanel` button while the caller's
   *  Details panel is already open). Defaults `false`; a caller that
   *  hasn't wired this through yet keeps rendering the button exactly as
   *  before. */
  detailsPanelOpen?: boolean;
  /** Forwarded straight through to every `TranscriptSessionSeparator`'s own
   *  `detailsPanelPreviewContent` (see that prop's own doc comment for the
   *  full "why" — restores the hover-preview `Popover` the record header's
   *  own Customer Information toggle used to show before this button
   *  relocated into the session row). Omit for a caller with no equivalent
   *  preview content ready to hand over (nothing else renders differently
   *  either way). */
  detailsPanelPreviewContent?: React.ReactNode;
  /** Forwarded straight through to every `TranscriptSessionSeparator`'s own
   *  `detailsPanelPreviewOpen` (see that prop's own doc comment). Defaults
   *  `false`. */
  detailsPanelPreviewOpen?: boolean;
  /** Forwarded straight through to every `TranscriptSessionSeparator`'s own
   *  `onDetailsPanelPreviewHoverStart` (see that prop's own doc comment). */
  onDetailsPanelPreviewHoverStart?: () => void;
  /** Forwarded straight through to every `TranscriptSessionSeparator`'s own
   *  `onDetailsPanelPreviewHoverEnd` (see that prop's own doc comment). */
  onDetailsPanelPreviewHoverEnd?: (e: React.MouseEvent | React.FocusEvent) => void;
  /** Forwarded straight through to every `TranscriptSessionSeparator`'s own
   *  `showViewDetails` prop (see that prop's own doc comment for the full
   *  "why" — the nested instance inside voice's "Transcript" tab passes
   *  `false`). Defaults `true`; every other call site is unaffected. */
  showViewDetails?: boolean;
  /** Forwarded straight through to every `TranscriptSessionSeparator`'s own
   *  `viewDetailsLabel` prop (see that prop's own doc comment) — Phase 1
   *  (Advanced)'s own call sites pass `"Session Details"`; every other
   *  consumer omits this and keeps the original "View Details" label. */
  viewDetailsLabel?: string;
  /** Forwarded straight through to the CURRENT session's own
   *  `TranscriptSessionSeparator` as `portalTarget` (see that prop's own
   *  doc comment for the full "why" — relocating that row out from under
   *  the "Session Details" `InteriorPanel`, which shares this same
   *  scrollable column and otherwise overlays it). Only ever applied to
   *  the session matching this component's own `lastSessionId` — any
   *  historical session (if one somehow renders) is unaffected and stays
   *  inline. Omit (every other tier/call site) to leave every session row
   *  rendering inline exactly as before. */
  sessionRowPortalTarget?: HTMLElement | null;
  /** Forwarded straight through to the CURRENT session's own
   *  `TranscriptSessionSeparator` as `hideFade` (see that prop's own doc
   *  comment) — per explicit follow-up request/screenshot, ALSO suppressed
   *  for a voice channel with its fullscreen video overlay open: that
   *  overlay is a sibling of this whole transcript (rendered by the tier
   *  page, absolutely positioned over this same content area — see
   *  `VideoCallFullScreen`'s own top doc comment), so the separator's
   *  trailing white-to-transparent fade — meant to soften real message
   *  bubbles scrolling underneath it — was instead painting a stray pale
   *  band over the top of the video. Defaults `false`; every other call
   *  site is unaffected. */
  hideSessionSeparatorFade?: boolean;
}) {
  const caseStatusCapable = useCapability((c) => c.interaction.caseStatus);
  // Settings → Assignments → "Show status chip in the session row" (k6 3): every mode; Outcome keeps its own status control.
  const [showStatusChip] = useSetting("assignments", "showStatusChip");
  const showSessionStatus = (showSessionStatusProp ?? caseStatusCapable) && showStatusChip;
  const contactOverview = contactOverviewIn;
  const customerContextOverview = overviewIn;
  const liveMessages = liveMessagesIn;
  // Which sessions this thread shows (a fresh launch's synthesized one, the
  // mock log, the reopens) and which is current: `deriveTranscriptSessions`
  // (transcript/transcript-sessions.ts), a pure function of these props, so
  // the page derives the same current session without mounting this. Computed
  // up here, before any hooks below, purely so `sessionsToRender`
  // (specifically its LAST entry's id) is available to `getSessionStatus`/
  // `selectSessionStatus`/`handleConfirmCloseSession` further down without
  // reordering those — this is a plain computation from props, not a hook
  // itself, so moving it earlier doesn't affect hook call order/count.
  const {
    isTextChannel,
    baseSessions: baseSessionsToRender,
    reopenedSessions: reopenedSessionsToRender,
    sessions: sessionsToRender,
    lastSessionId,
  } = deriveTranscriptSessions({
    channelType,
    isFreshLaunch,
    contactId,
    channelAddressLabel,
    skillLabel,
    hideMockFollowUpMessages,
    reopenedContacts,
  });

  // Slices the one flat `liveMessages` array back into per-session chunks,
  // keyed by session id — per explicit correction, reopening a closed
  // channel must NOT wipe its prior messages; they need to keep rendering
  // (dimmed) under their ORIGINAL session, with only the messages sent
  // since the reopen landing under the new one. Each `reopenedContacts`
  // entry's own `messagesBeforeReopen` (see that field's own doc comment)
  // is the exact index boundary: everything before the first reopen's
  // boundary belongs to `baseSessionsToRender`'s own last id (the session
  // `liveMessages` always attached to before reopens existed at all);
  // everything between one reopen's boundary and the next belongs to that
  // reopen's own session id; everything after the last boundary belongs to
  // the most recent reopen. Plain computation (not a memo) — cheap, and
  // `sessionsToRender` right above it isn't memoized either.
  const baseLiveMessageSessionId = baseSessionsToRender[baseSessionsToRender.length - 1]?.id;
  const liveMessagesBySessionId: Record<string, TranscriptMessage[]> = {};
  if (isTextChannel) {
    const boundaries = reopenedSessionsToRender.map(
      (_, idx) => reopenedContacts?.[idx]?.messagesBeforeReopen ?? liveMessages.length
    );
    let start = 0;
    if (baseLiveMessageSessionId) {
      const end = boundaries[0] ?? liveMessages.length;
      liveMessagesBySessionId[baseLiveMessageSessionId] = liveMessages.slice(0, end);
      start = end;
    }
    reopenedSessionsToRender.forEach((session, idx) => {
      const end = boundaries[idx + 1] ?? liveMessages.length;
      liveMessagesBySessionId[session.id] = liveMessages.slice(start, end);
      start = end;
    });
  } else if (baseLiveMessageSessionId) {
    // Voice/Email — no reopen concept at all (see `isTextChannel`'s own
    // gate above); the whole flat array still attaches to the single base
    // session's id, same as before this per-session slicing existed.
    liveMessagesBySessionId[baseLiveMessageSessionId] = liveMessages;
  }

  // Which of the two `ContactOverview` spots below actually renders it —
  // see `contactOverviewPosition`'s own doc comment for why this isn't
  // simply `isFreshLaunch` itself for every caller.
  const contactOverviewAtBottom = contactOverviewPosition
    ? contactOverviewPosition === "bottom"
    : !isFreshLaunch;
  // Once an approval request is in the conversation, the Autosummary sits directly above it (for quick access) instead of at the top.
  const overviewBeforeApproval =
    contactOverviewPosition === "top" && !!(contactOverview || customerContextOverview) && liveMessages.some((m) => !!m.summary);

  // Per explicit follow-up bug report ("you put it above the latest
  // interaction bubbles - it should be at the bottom"): for the transfer/
  // existing-conversation `ContactOverview` spot (`contactOverviewAtBottom`,
  // below), this session's own `liveMessagesBySessionId` entry can ALREADY contain
  // pre-existing conversation content when the transcript first renders
  // (a Contact History resume seeds its whole prior conversation through
  // `liveMessages`, not the fixed `messages` array) — rendering
  // `ContactOverview` before ALL of those put it above messages that were
  // already there before the agent even opened this contact, not "at the
  // bottom." This ref captures, once per `contactId`, exactly how many of
  // `lastSessionId`'s live messages already existed at that first render —
  // everything up to that count renders ABOVE `ContactOverview` (a
  // continuation of the existing conversation), everything past it renders
  // BELOW (genuinely new, sent/received after this pickup). Applied during
  // render (compare against the last-seen `contactId`, same "adjust a ref
  // when a tracked key changes" pattern `InteractionNavItem`'s own
  // `channelsExpandedOverride` uses) rather than inside a `useEffect`, so
  // the very first render after a contact loads already has the correct
  // split — a `useEffect` would run one render late, letting messages that
  // were already there sneak in below the line for one frame.
  const lastContactOverviewBoundaryContactIdRef = useRef<string | undefined>(undefined);
  const contactOverviewLiveMessageBoundaryRef = useRef(0);
  if (lastContactOverviewBoundaryContactIdRef.current !== contactId) {
    lastContactOverviewBoundaryContactIdRef.current = contactId;
    contactOverviewLiveMessageBoundaryRef.current = (liveMessagesBySessionId[lastSessionId ?? ""] ?? []).length;
  }

  // Renders whichever of the two overview blocks this call actually wants
  // — the newer `CustomerContextOverview` when a caller supplies
  // `customerContextOverview` (see that prop's own doc comment above), else
  // the original `ContactOverview` when a caller supplies `contactOverview`
  // — shared by both of the two render spots below so neither has to
  // duplicate this branch.
  // Hiding AI actions collapses (fade + slide up) rather than unmounting, mirroring the entrance animation.
  // The cards in the caller's `overview` (`AutosummaryCard`) carry their own enter animation.
  // `inStack`: a block of the session's content stack, which owns the top spacing; each
  // block owns only the space below it (`pb-4`), inside the collapse so hiding drops it too.
  const renderContactOverviewBlock = (inStack = false) => (
    <AiActionCollapse hidden={hideAiActions}>
      <div className={cn(inStack && "pb-4")}>{renderContactOverviewBlockInner()}</div>
    </AiActionCollapse>
  );
  const renderContactOverviewBlockInner = () =>
    customerContextOverview ? (
      <div className="flex flex-col gap-3">{customerContextOverview}</div>
    ) : (
      contactOverview && (
        <ContactOverview
          customerName={displayName}
          previousAgent={contactOverview.previousAgent}
          snapshot={contactOverview.snapshot}
          journeySummary={contactOverview.journeySummary}
          onViewCustomerInfo={onViewCustomerInfo}
          onViewInteractionHistory={onViewInteractionHistory}
          onLaunchPreviousAgentInteraction={onLaunchPreviousAgentInteraction}
        />
      )
    );

  // Local, per-session tag state — removing/adding a tag on one message
  // shouldn't touch any other message's tags (in this session or any
  // other), so this is keyed by session id rather than one flat array.
  const [sessionMessages, setSessionMessages] = useState<Record<string, TranscriptMessage[]>>(() =>
    Object.fromEntries(TRANSCRIPT_SESSIONS.map((s) => [s.id, s.messages]))
  );
  // Ids already present when this transcript first rendered — anything that
  // arrives later (a live/simulated message) slides + fades in, same entrance
  // Marcus Webb's chat uses; the initial history renders without animation.
  const initialMessageIdsRef = useRef<Set<string> | null>(null);
  if (initialMessageIdsRef.current === null) {
    initialMessageIdsRef.current = new Set(liveMessages.map((m) => m.id));
  }
  // Which message's "Add tag" popover is open — at most one at a time,
  // across every session (message ids are already unique per session, so
  // a single id is enough with no session key needed alongside it).
  const [tagPickerOpenId, setTagPickerOpenId] = useState<string | null>(null);

  // Which CLOSED sessions have their message content collapsed away — a
  // per-session `Set`, independent toggles rather than an exclusive
  // accordion, same as the now-removed `openSessionIds` used to be
  // ("View Details" no longer toggles anything in place here — see
  // `TranscriptSessionSeparator`'s own doc comment). This animates this
  // session's own message bubbles (rendered
  // further down, in this session's own per-session block) shut. Only a
  // session that reads "Closed" ever exposes the collapse icon that flips
  // this (`TranscriptSessionSeparator`'s own `onToggleCollapsed` doc
  // comment) — a still-open session's id never lands in this set.
  const [collapsedSessionIds, setCollapsedSessionIds] = useState<Set<string>>(new Set());

  const toggleSessionCollapsed = (sessionId: string) => {
    setCollapsedSessionIds((prev) => {
      const next = new Set(prev);
      if (next.has(sessionId)) next.delete(sessionId);
      else next.add(sessionId);
      return next;
    });
  };

  // Per explicit bug fix: a contact with more than one session (multiple
  // past, Closed threads plus the current one) used to load with EVERY
  // session's message content expanded — `collapsedSessionIds` started out
  // empty, so nothing was collapsed until an agent manually clicked one
  // shut. Every session but `lastSessionId` always reads "Closed"
  // (`getSessionStatus`, above), so on a genuinely fresh contact load
  // (`contactId` — this prop identifies the specific channel/thread being
  // viewed, not just the customer) every one of THOSE gets collapsed by
  // default here, leaving only the current session's own messages visible
  // — an agent can still re-expand any of them individually via
  // `toggleSessionCollapsed` same as before, this only changes the
  // starting state. Deliberately NOT included in the dependency array:
  // `sessionsToRender`/`lastSessionId` themselves — this should fire once
  // per contact load, not re-collapse a session the agent just re-expanded
  // simply because a live message arrived and re-triggered a re-render.
  useEffect(() => {
    setCollapsedSessionIds(
      new Set(sessionsToRender.filter((session) => session.id !== lastSessionId).map((session) => session.id))
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contactId]);

  // The CURRENT session's status is `currentStatus`, a prop from
  // `Interaction` (see its own doc comment for why) — every OTHER
  // (historical) session in this Thread always reads "Closed", full stop,
  // regardless of whatever its own static `status` field says. Per
  // explicit bug report/fix: this used to fall back to each historical
  // session's own `status` (only forced to "Closed" when it had been
  // specifically superseded by a live reopen) — a real, confirmed bug,
  // since a Thread's fixed mock session data (`TRANSCRIPT_SESSIONS`/
  // `_VOICE`/`_EMAIL`) can have more than one entry that was never
  // authored as "Closed" (e.g. two consecutive "Resolved" rows), which
  // rendered as two simultaneously "open"-looking sessions in one Thread.
  // There should never be more than one non-Closed session in a Thread —
  // only the current one is ever actually live — so this is now a plain
  // position check with no other source to fall back to. The local
  // "freeze any historical session's status via its own popover" override
  // this used to support is gone along with it — see
  // `TranscriptSessionSeparator`'s own `isCurrentSession` doc comment:
  // a historical session's status pill is now always locked, so that
  // popover can never actually open to override anything in the first
  // place.
  // (`sessionStatusOf`, transcript-sessions.ts.) The page reads a thread's
  // current session from the same derivation (`currentSessionOf`), so this
  // transcript reports nothing up (P-EXTRACT: it used to, from an effect,
  // which only worked while it was mounted).
  const getSessionStatus = (session: TranscriptSession) => sessionStatusOf(session, lastSessionId, currentStatus);

  // Which session's status popover is open, and which of that popover's two
  // bodies (the status list, or the "Close Contact?" confirm) it's
  // currently showing — see `TranscriptSessionSeparator`'s own doc comment
  // for why this is one Popover with a swappable body rather than two. At
  // most one open across the whole transcript at a time, same pattern as
  // `tagPickerOpenId` above.
  const [statusMenuOpenId, setStatusMenuOpenId] = useState<string | null>(null);
  const [statusMenuView, setStatusMenuView] = useState<"menu" | "confirm">("menu");

  // Opening (or re-opening) a session's status popover always starts on the
  // list view, never stranded on a stale "confirm" from a previous visit —
  // `onStatusMenuOpenChange(false)` (outside click, Escape, re-clicking the
  // trigger) resets both pieces of state so the next open is always fresh.
  const handleStatusMenuOpenChange = (sessionId: string, open: boolean) => {
    if (open) {
      setStatusMenuView("menu");
      setStatusMenuOpenId(sessionId);
    } else {
      setStatusMenuOpenId(null);
      setStatusMenuView("menu");
    }
  };

  // A non-"Closed" status picked straight from the list — applies right
  // away and closes the popover. "Closed" itself is deliberately not
  // handled here; see `handleConfirmCloseSession` below for why that one
  // status needs a confirm step first. Always routes to
  // `onCurrentStatusChange` (up onto `Interaction`) — per explicit
  // request/bug fix, only the CURRENT session's status pill is ever
  // unlocked at all now (`TranscriptSessionSeparator`'s own
  // `isCurrentSession`/`isClosed`, see that prop's doc comment), so this
  // is never actually reachable for any other (historical) session; no
  // `sessionId` parameter needed to branch on anymore.
  const selectSessionStatus = (status: string) => {
    if (status === "Closed") {
      setStatusMenuView("confirm");
      return;
    }
    onCurrentStatusChange(status);
    setStatusMenuOpenId(null);
  };

  const handleConfirmCloseSession = () => {
    onCurrentStatusChange("Closed");
    setStatusMenuOpenId(null);
    setStatusMenuView("menu");
  };

  const handleCancelCloseSession = () => {
    setStatusMenuOpenId(null);
    setStatusMenuView("menu");
  };

  const removeTag = (sessionId: string, messageId: string, tagId: string) => {
    setSessionMessages((prev) => ({
      ...prev,
      [sessionId]: prev[sessionId].map((m) => (m.id === messageId ? { ...m, tags: m.tags?.filter((t) => t.id !== tagId) } : m)),
    }));
  };

  const clearTags = (sessionId: string, messageId: string) => {
    setSessionMessages((prev) => ({
      ...prev,
      [sessionId]: prev[sessionId].map((m) => (m.id === messageId ? { ...m, tags: [] } : m)),
    }));
  };

  const addTag = (sessionId: string, messageId: string, option: Omit<TranscriptTag, "id">) => {
    setSessionMessages((prev) => ({
      ...prev,
      [sessionId]: prev[sessionId].map((m) =>
        m.id === messageId
          ? { ...m, tags: [...(m.tags ?? []), { ...option, id: `${messageId}-${option.label.toLowerCase()}` }] }
          : m
      ),
    }));
    // Deliberately doesn't close the popover — picking a tag is meant to be
    // a quick multi-select (add Complain, then Help, then close when done),
    // not a one-shot pick. Closing is explicit: the header's close button,
    // or clicking off the popover (Radix's default outside-click handling
    // on `PopoverPrimitive.Content`, unchanged here).
  };

  const copyMessage = (text: string) => {
    navigator.clipboard?.writeText(text).catch(() => {});
  };

  // Tag state for `liveMessages` (sent/received messages, not the fixed mock
  // log) — kept separate from `sessionMessages` above; see `liveMessages`
  // prop's own doc comment for why. Keyed by message id, same shape as
  // `sessionMessages`' per-message tags, just not nested under a session id
  // since there's only ever one flat live list, not several sessions' worth.
  const [liveMessageTags, setLiveMessageTags] = useState<Record<string, TranscriptTag[]>>({});

  const addLiveTag = (messageId: string, option: Omit<TranscriptTag, "id">) => {
    setLiveMessageTags((prev) => ({
      ...prev,
      [messageId]: [...(prev[messageId] ?? []), { ...option, id: `${messageId}-${option.label.toLowerCase()}` }],
    }));
  };

  const removeLiveTag = (messageId: string, tagId: string) => {
    setLiveMessageTags((prev) => ({
      ...prev,
      [messageId]: (prev[messageId] ?? []).filter((t) => t.id !== tagId),
    }));
  };

  const clearLiveTags = (messageId: string) => {
    setLiveMessageTags((prev) => ({ ...prev, [messageId]: [] }));
  };

  // Scroll container ref — see the `useLayoutEffect` further below (after
  // `isAtBottom` is declared, which it also resets) for the actual
  // scroll-to-latest-on-open/on-channel-switch behavior. Declared up here
  // since the `ResizeObserver` effect right below also needs it.
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  // `trailingContent` scrolls into view once per `trailingContentKey` (the
  // first time this transcript shows it), smoothly; after that the agent's
  // own scroll position is left alone, so they can scroll back up.
  const trailingContentRef = useRef<HTMLDivElement>(null);
  const scrolledTrailingKeysRef = useRef(new Set<string>());
  useEffect(() => {
    if (!trailingContentKey || scrolledTrailingKeysRef.current.has(trailingContentKey)) return;
    scrolledTrailingKeysRef.current.add(trailingContentKey);
    trailingContentRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [trailingContentKey]);
  // Marks the true bottom of the rendered transcript content — see the
  // mount/open scroll-to-bottom effect below (`[contactId]`) for why this
  // exists: an invisible target for `scrollIntoView()` rather than relying
  // on `scrollContainerRef`'s own (sometimes-inert) `scrollHeight`.
  // Rendered once, as the very last node inside the message column (see
  // its own render site, right after the sessions `.map()` closes).
  const bottomSentinelRef = useRef<HTMLDivElement>(null);

  // Below 400px of this transcript's own rendered width: drop each
  // message's sender avatar (`transcriptNarrow`, threaded into each real
  // message bubble's own `narrow` prop as an override — see
  // `TranscriptMessageBubble`'s own doc comment). Below 768px: grow the
  // TYPING INDICATOR's own bubble to full width, matching the real message
  // bubbles' own independent 80%/full-width breakpoint — per explicit
  // request (`ChatMessage`, lyra-ui, self-measures that breakpoint
  // internally off its own root element and needs no prop from here; the
  // `TypingIndicator` below is still a local, un-ported component with no
  // measurement of its own, so it needs `transcriptBubbleFullWidth` handed
  // down explicitly to stay visually consistent with the real bubbles
  // beside it). Both measured directly off this same scroll container via
  // one shared `ResizeObserver`, same pattern `ScheduleToolbar`'s own
  // `containerRef`/`isWide`/`isCompact` already uses for its Add/Day/Week
  // collapse (SchedulePanel.tsx) — a CSS `@container` query here stopped
  // firing reliably for the agent live-testing it, even after several
  // rounds of review/hardening.
  const [transcriptNarrow, setTranscriptNarrow] = useState(false);
  const [transcriptBubbleFullWidth, setTranscriptBubbleFullWidth] = useState(false);
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const applyWidth = (width: number) => {
      setTranscriptNarrow(width < 400);
      setTranscriptBubbleFullWidth(width < 768);
    };
    applyWidth(el.getBoundingClientRect().width);
    const ro = new ResizeObserver(([entry]) => applyWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Total message count across every session — the one number that tells us
  // whether "new" messages have shown up since the agent last looked at the
  // bottom of the transcript. Flattened rather than tracked per-session
  // since the "N new" chip is a single count regardless of which session(s)
  // the new messages landed in.
  const totalMessageCount = useMemo(
    () => Object.values(sessionMessages).reduce((sum, messages) => sum + messages.length, 0) + liveMessages.length,
    [sessionMessages, liveMessages]
  );

  // Whether the agent is currently scrolled to (near) the bottom — drives
  // the floating "Scroll To Latest" affordance, which should only appear
  // once they've scrolled up and away from the live edge of the
  // conversation.
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [newMessageCount, setNewMessageCount] = useState(0);
  // How many total messages had arrived as of the last time the agent was
  // at the bottom — a ref (not state) since it's only ever read inside
  // effects/handlers, never rendered directly.
  const lastSeenCountRef = useRef(totalMessageCount);
  // Mirrors `isAtBottom` into a ref purely so the auto-scroll effect below
  // can read its *current* value without listing it as a dependency — see
  // that effect's own comment for why it deliberately only re-fires on
  // `totalMessageCount` changing, not on every `isAtBottom` flip.
  const isAtBottomRef = useRef(isAtBottom);
  useEffect(() => {
    isAtBottomRef.current = isAtBottom;
  }, [isAtBottom]);

  // Scroll to the latest message on open — every SMS/chat transcript should
  // land on the newest message (bottom of the last session) rather than the
  // very first one from potentially days ago. `useLayoutEffect` (not
  // `useEffect`) so this happens before the browser paints the first frame
  // — no visible flash of the top of the transcript before it jumps to the
  // bottom.
  // Depends on `contactId` — the ACTIVE channel's own base Contact id (see
  // that prop's own doc comment; unique per Thread, so it changes every
  // time the agent switches to a different channel tab) — not an empty
  // array. Per explicit bug report: `InteractionTranscript` is one long-
  // lived component instance for the whole interaction (never remounted as
  // the agent flips between its channel tabs — no `key` at the call site),
  // so an empty-deps effect only ever fired once, the very first time this
  // interaction's transcript opened. Every LATER channel switch left
  // `scrollContainerRef`'s raw `scrollTop` pixel value untouched while the
  // DOM underneath it was completely replaced with a different channel's
  // (usually differently-sized) content — the agent would land wherever
  // that stale pixel offset happened to fall in the new content, which
  // read as "goes to the top" for a multi-session chat/SMS thread far more
  // often than not. Re-running this on every `contactId` change re-lands on
  // the bottom every time, matching the original "land on open" intent but
  // now firing on every channel switch, not just the very first one.
  // `setIsAtBottom(true)` alongside it — same "as if they'd clicked Scroll
  // To Latest" reset `scrollToLatest`/the agent's-own-just-sent-message
  // branch below already do — so the "N new" chip/count (which otherwise
  // would've kept comparing against whatever channel was last read) starts
  // clean for the newly-viewed channel too.
  // Single scroll-to-bottom implementation every call site below shares
  // (this mount effect, the auto-scroll-on-new-message effect, and both
  // the "Scroll To Latest"/"Sync to Live" buttons' own `onClick`) — see
  // `bottomSentinelRef`'s own declaration for why this targets THAT
  // sentinel via `Element.scrollIntoView()` rather than setting
  // `scrollContainerRef.current.scrollTop`/`.scrollTo(...)` directly, which
  // is a no-op wherever this component is nested inside an ALREADY-
  // scrollable ancestor (the docked Customer Information panel's own
  // "Transcript" tab, and its hover-preview twin — see that mount effect's
  // former version, in git history, for the full "why" this replaced it):
  // `scrollIntoView()` walks up to whichever ancestor actually owns the
  // scrollbar and scrolls THAT one, so this lands correctly in every
  // context this component is mounted in, not just the main record
  // column (where `scrollContainerRef` itself happens to be the real
  // scroll container).
  // While an automatic scroll is settling (new content just landed and we're smooth-scrolling to it), the sentinel is
  // briefly below the fold; `autoScrollUntilRef` lets the "not at bottom" detection below ignore that window so the
  // "Scroll To Latest" button doesn't flash every time content is added.
  const autoScrollUntilRef = useRef(0);
  const scrollToBottom = (behavior: ScrollBehavior = "auto") => {
    autoScrollUntilRef.current = Date.now() + 900;
    bottomSentinelRef.current?.scrollIntoView({ block: "end", behavior });
  };

  useLayoutEffect(() => {
    // `useLayoutEffect` (not `useEffect`) so this happens before the
    // browser paints the first frame — no visible flash of the top of the
    // transcript before it jumps to the bottom.
    scrollToBottom();
    setIsAtBottom(true);
    // Safety net for a still-settling ancestor (the docked panel's own
    // opening transition, running in this same commit as this mount) —
    // re-applies the same scroll once that layout has settled.
    const raf = requestAnimationFrame(() => scrollToBottom());
    return () => cancelAnimationFrame(raf);
  }, [contactId]);

  // Tracks whether the agent is scrolled to the live edge of the
  // transcript — drives the floating "Scroll To Latest"/"Sync to Live"
  // affordance below. An `IntersectionObserver` on `bottomSentinelRef`,
  // not the old `onScroll`/`scrollTop` math against `scrollContainerRef`
  // (see `scrollToBottom`'s own doc comment for why that math only ever
  // reflected reality in the main record column): an `IntersectionObserver`
  // with no explicit `root` measures intersection against the viewport,
  // which is computed correctly straight through any number of clipping/
  // scrolling ancestors in between — so "is the latest message actually
  // on screen" comes out right in every context this component mounts in,
  // not just the one where `scrollContainerRef` happens to be the real
  // scroll container.
  // Whether the latest message is on screen, measured against the viewport AND every clipping ancestor (the docked and
  // hover-preview Transcript panels clip their own content, which a plain viewport-rooted observer got wrong). Polled
  // lightly rather than observed so it also catches content growth. A small bottom tolerance counts "almost at the
  // bottom" as at the bottom, and "left the bottom" must hold for a moment and outlast any automatic scroll in progress,
  // so adding content never flashes the "Scroll To Latest" button.
  useEffect(() => {
    const target = bottomSentinelRef.current;
    if (!target) return;
    const TOLERANCE = 96;
    const isNearBottom = () => {
      const top = target.getBoundingClientRect().top;
      let limit = window.innerHeight;
      for (let el = target.parentElement; el; el = el.parentElement) {
        if (getComputedStyle(el).overflowY !== "visible") limit = Math.min(limit, el.getBoundingClientRect().bottom);
      }
      return top <= limit + TOLERANCE;
    };
    let awaySince: number | null = null;
    const tick = () => {
      if (isNearBottom()) {
        awaySince = null;
        setIsAtBottom(true);
        return;
      }
      const now = Date.now();
      if (now < autoScrollUntilRef.current) {
        awaySince = null;
        return;
      }
      if (awaySince === null) awaySince = now;
      else if (now - awaySince >= 400) setIsAtBottom(false);
    };
    const id = window.setInterval(tick, 150);
    return () => window.clearInterval(id);
  }, [contactId]);

  // Keeps the "N new" count in sync with reality: while at the bottom,
  // every message is by definition "seen," so the seen-count tracks the
  // live total and the chip stays hidden; once the agent scrolls away, any
  // further growth in the total is exactly how many they've missed.
  useEffect(() => {
    if (isAtBottom) {
      lastSeenCountRef.current = totalMessageCount;
      setNewMessageCount(0);
    } else {
      setNewMessageCount(Math.max(0, totalMessageCount - lastSeenCountRef.current));
    }
  }, [totalMessageCount, isAtBottom]);

  // Auto-scroll to the newest message as new ones arrive (a sent message, or
  // the simulated customer reply that follows it a couple seconds later).
  // Two different rules for the two cases:
  //  - The agent's OWN just-sent message always scrolls to it, regardless of
  //    where they'd scrolled to — they just took an action in this
  //    conversation, so they should see it land, same as `scrollToLatest`
  //    below. Also resets `isAtBottom` to `true` (as if they'd clicked
  //    "Scroll To Latest" themselves), so the customer's reply a couple
  //    seconds later keeps auto-scrolling right along with it too.
  //  - The simulated customer reply only scrolls if the agent was already
  //    caught up to the bottom (`isAtBottomRef.current`, read fresh rather
  //    than depended on — see that ref's own comment) — if they've scrolled
  //    up to read earlier messages, an incoming reply shouldn't yank them
  //    back down; it only self-resumes once they scroll back down
  //    themselves (the `IntersectionObserver` above) or click "Scroll To
  //    Latest"/"Sync to Live".
  // Distinguished by `liveMessages`' own last entry's `sender` — the fixed
  // mock log never changes at runtime, so any growth in `liveMessages` is
  // exactly "the agent sent one" or "the customer replied," in that order.
  // Keyed on `liveMessages.length` (a primitive), not the `liveMessages`
  // array itself — that's a fresh `[]` reference every render an
  // interaction has no live messages yet (`activeInteraction.liveMessages
  // ?? []` at the call site), which would otherwise re-fire this effect on
  // every unrelated re-render (e.g. the shared clock tick).
  useEffect(() => {
    const lastLiveMessage = liveMessages[liveMessages.length - 1];
    const isOwnJustSentMessage = lastLiveMessage?.sender === "agent";
    if (!isOwnJustSentMessage && !isAtBottomRef.current) return;
    scrollToBottom("smooth");
    if (isOwnJustSentMessage) setIsAtBottom(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveMessages.length]);

  // Auto-scroll on ANY growth of the scrollable content, not just new
  // messages — per explicit request, the Next Best Action block (an opaque
  // `nextBestActionContent`/`customerContextOverview` ReactNode this
  // component knows nothing about internally) can grow on its own terms
  // (a step list advancing, a question appearing, a photo showing up) with
  // no change to `liveMessages` at all, so the effect above alone can't
  // catch it. A `ResizeObserver` on `contentWrapperRef` (the `<div
  // className="w-full">` wrapping every session's rendered content, see
  // its own render site below) fires on any such height change, generically
  // — same "only if already at bottom" rule as above (`isAtBottomRef`),
  // reusing the exact same `scrollToBottom` helper. Harmless overlap with
  // the message-specific effect above (both just call the same idempotent
  // scroll).
  const contentWrapperRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = contentWrapperRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      if (isAtBottomRef.current) scrollToBottom("smooth");
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const scrollToLatest = () => {
    scrollToBottom("smooth");
    setIsAtBottom(true);
  };

  // SMS/WhatsApp (and no active channel yet) — the existing mock chat log,
  // with every customer-sender message's hardcoded mock name/initials
  // ("Liam Davis"/"LD") swapped for this interaction's real customer (see
  // this component's own doc comment above). Only `TranscriptMessageBubble`
  // sees the substituted copy — `sessionMessages` itself (and its tag
  // mutations, keyed by the mock message ids) stays untouched.
  const displayName = customerName?.trim() || "Liam Davis";
  const displayInitials = initialsFor(displayName);

  return (
    // `min-w-0` here — this ROOT div is a flex item of its own
    // `flex flex-1 flex-col min-w-0 overflow-hidden` parent (the record
    // body column, this component's own call site) and was missing
    // `min-w-0` itself. A flex item's default `min-width: auto` applies
    // the browser's "automatic minimum size" floor — the width of
    // whatever's widest UN-WRAPPABLE content anywhere in this subtree —
    // to ANY auto-sized box, not just main-axis flex-grow/shrink
    // distribution; a column-direction parent's cross-axis
    // `align-items: stretch` still respects that floor. Found while
    // chasing a reported width-collapse regression; a real, independent
    // correctness fix kept regardless of how `transcriptNarrow` below
    // ended up being measured.
    // A flex column with the scroller as its `min-h-0 flex-1` child (not
    // `h-full`), so it's the scroller wherever it sits: the main column
    // (a definite height) or a hover preview (only a max height).
    <div className={sessionRowOnly ? "relative shrink-0 min-w-0" : "relative flex min-h-0 min-w-0 flex-1 flex-col"}>
      <div
        ref={scrollContainerRef}
        className={sessionRowOnly ? undefined : "min-h-0 flex-1 overflow-y-auto"}
      >
        {/* Per explicit follow-up request, un-reverting the max-width-back
            change just above it ("dang - revert that last change - go back
            to full screen width"): back to full width again — no
            `max-w`/`mx-auto`/`px-6` on this outer wrapper. The
            `TranscriptSessionSeparator` row (the sticky "N Messages |
            #contactId · date" bar) renders edge-to-edge across the full
            scrollable width instead of being boxed into the same centered
            1024px column as the message bubbles below it — that row picked
            its own `px-6` back up directly on its root (see that
            component's own doc comment) since it no longer inherits an
            inset from this now-unconstrained parent. The 1024px-centered
            column lives on a new wrapper around just the message content,
            per session (see `sessionContentDimmed`'s own wrapper div
            further down) — message bubbles are unaffected visually, still
            centered at the same width as before; only the separator row
            above them is full width. Sticky-STACKING behavior is
            unaffected either way — `position: sticky` resolves against the
            nearest scrolling ancestor (the `overflow-y-auto` div above),
            not against this width constraint. */}
        <div ref={contentWrapperRef} className="w-full">
          {/* Per explicit request ("let's not have multiple threads in a
              chat anymore - simply hide the ones in the existing
              assignments"): only the CURRENT session (`lastSessionId`)
              ever renders here now — every historical session (a past
              `TRANSCRIPT_SESSIONS`/`_VOICE`/`_EMAIL` entry, or an earlier
              `reopenedContacts` entry) is filtered out of the scrollable
              transcript entirely, not just collapsed (the previous
              behavior — see `collapsedSessionIds`' own doc comment above,
              now dead code left in place rather than ripped out: reopening
              a channel still needs its own fresh `Contact` object with a
              new id for `currentStatus`/`onCurrentStatusChange` to attach
              to, and Contact History/session-count bookkeeping elsewhere
              still reads the full un-filtered `sessionsToRender`/
              `liveMessagesBySessionId`, so removing the underlying
              multi-session data model itself would be a much bigger,
              riskier change than what was actually asked for here — a
              purely visual hide). A single still-visible session with no
              other one to distinguish it from reads a little oddly with a
              full "N Messages | #contactId · date" separator bar of its
              own still on screen, but that bar is also this session's only
              home for its status pill/Consult/Transfer/Outcome/Unassign
              cluster, so it stays. */}
          {sessionsToRender
            .filter((session) => session.id === lastSessionId)
            .map((session) => {
            // Falls back to `[]` for the synthetic "just launched" session
            // (not seeded into `sessionMessages` at mount, since it isn't
            // part of the fixed `TRANSCRIPT_SESSIONS` array that seeds that
            // state) — genuinely empty there, not a bug.
            const messages =
              hideAllMessages || (hideMockFollowUpMessages && session.id === "session-2")
                ? []
                : sessionMessages[session.id] ?? [];
            // Patches this session's own current status (which may have
            // been changed via the status popover) onto the otherwise-
            // static session object — `TranscriptSessionSeparator`'s chip
            // and `TranscriptSessionDetails`' "Status" row both read
            // straight off `session.status`, so this one patch keeps both
            // in sync without either needing a separate status prop.
            const sessionWithCurrentStatus: TranscriptSession = {
              ...session,
              status: getSessionStatus(session),
            };
            // Per explicit request: the session detail row itself
            // (`TranscriptSessionSeparator` — the sticky "customerName |
            // address | N Messages | #contactId · date" header, plus its
            // status tag/Consult/Transfer/Outcome cluster) no longer dims
            // when a session reads as closed/historical — only the actual
            // conversation content under it (the mock/live message bubbles,
            // and the Voice/Email "Coming Soon" placeholder) still fades to
            // 50% opacity. Was one `opacity-50` on the whole per-session
            // wrapper (separator included) — moved down onto a new inner
            // wrapper around just the content below the separator instead;
            // see that inner div further down.
            const sessionContentDimmed = session.id !== lastSessionId || dimmed;
            return (
              <div key={session.id} className="flex flex-col">
                {/* No wrapping div around this root — per explicit bug fix
                    ("not sticky at the top anymore"), this must stay a
                    DIRECT child of the per-session `<div key={session.id}>`
                    below, a sibling of the message content div further
                    down, so its containing block has real height to
                    "stick" through as the page scrolls. Its own `px-6` (and
                    full-width, no `max-w`) is applied directly on its root
                    className now instead — see that component's own doc
                    comment. */}
                {/* `hideCurrentSessionRow`: the caller shows the current session's row elsewhere (the docked panel's header, k5 B). */}
                {!(hideCurrentSessionRow && session.id === lastSessionId) && (
                <TranscriptSessionSeparator
                  // Per explicit bug fix — this separator's own trailing
                  // fade otherwise paints straight over the `ContactOverview`
                  // block's heading when it's the first thing rendered
                  // right underneath, OR over the fullscreen video overlay
                  // sitting behind this same session (see `hideFade`'s own
                  // doc comment, and `hideSessionSeparatorFade`'s own doc
                  // comment on this component's own props for the latter).
                  hideFade={
                    (!!(contactOverview || customerContextOverview) && session.id === lastSessionId) ||
                    (hideSessionSeparatorFade && session.id === lastSessionId)
                  }
                  session={sessionWithCurrentStatus}
                  onViewDetails={() => onViewSessionDetails?.(sessionWithCurrentStatus)}
                  onToggleDetailsPanel={onToggleDetailsPanel}
                  detailsPanelOpen={detailsPanelOpen}
                  detailsPanelPreviewContent={detailsPanelPreviewContent}
                  detailsPanelPreviewOpen={detailsPanelPreviewOpen}
                  onDetailsPanelPreviewHoverStart={onDetailsPanelPreviewHoverStart}
                  onDetailsPanelPreviewHoverEnd={onDetailsPanelPreviewHoverEnd}
                  showViewDetails={showViewDetails}
                  viewDetailsLabel={viewDetailsLabel}
                  // See `sessionRowPortalTarget`'s own doc comment above —
                  // only the CURRENT session's row ever relocates into the
                  // record header; a historical session (if one somehow
                  // renders) keeps rendering inline.
                  portalTarget={session.id === lastSessionId ? sessionRowPortalTarget : undefined}
                  // Only a real, meaningful count for chat/SMS/WhatsApp —
                  // see this prop's own doc comment on `Contact
                  // Separator` for why Voice/Email (`messages: []`
                  // placeholders) are left `undefined` instead of `0`. Adds
                  // in this session's own slice of live messages
                  // (`liveMessagesBySessionId`) on top of the static mock
                  // count — a fresh/reopened synthetic session always has
                  // `messages: []` (nothing seeded into `sessionMessages`
                  // for it), so without this its header would always read
                  // "0 Messages" even once real messages exist under it.
                  messageCount={
                    isTextChannel
                      ? messages.length + (liveMessagesBySessionId[session.id]?.length ?? 0)
                      : undefined
                  }
                  statusMenuOpen={statusMenuOpenId === session.id}
                  statusMenuView={statusMenuView}
                  onStatusMenuOpenChange={(nextOpen) => handleStatusMenuOpenChange(session.id, nextOpen)}
                  onSelectStatus={selectSessionStatus}
                  onConfirmClose={handleConfirmCloseSession}
                  onCancelClose={handleCancelCloseSession}
                  // Real Outcome popover only for the CURRENT session (see
                  // this prop's own doc comment) — reuses `currentStatus`/
                  // `onCurrentStatusChange` (this component's own props)
                  // for the "Status" field, same as the LeftNav's
                  // `ChannelRow` Outcome button does for this same channel's
                  // own `interaction.channelStatuses` entry/`handleInteractionStatusChange`.
                  outcome={
                    session.id === lastSessionId && outcomeOpen !== undefined
                      ? {
                          open: outcomeOpen,
                          onOpenChange: onOutcomeOpenChange!,
                          resolutionOptions: TRANSCRIPT_SESSION_STATUS_OPTIONS,
                          // Per explicit bug fix — was `?? "Resolved"`: a
                          // channel with no status set yet (the common case
                          // for a just-launched thread, before the agent's
                          // ever touched the status pill) was reading as
                          // already wrapped up before anything happened.
                          // "Open" is the correct fallback for genuinely
                          // untouched status — matches the same options
                          // list's own first entry (`TRANSCRIPT_SESSION_STATUS_OPTIONS`).
                          resolution: currentStatus ?? "Open",
                          onResolutionChange: (value: string) => onCurrentStatusChange(value),
                          voice: channelType === "voice",
                          tagOptions: OUTCOME_TAG_OPTIONS,
                          selectedTags: outcomeTags ?? [],
                          onTagsChange: onOutcomeTagsChange!,
                          dispositionOptions: OUTCOME_DISPOSITION_OPTIONS,
                          dispositionCode: outcomeDispositionCode ?? OUTCOME_DISPOSITION_OPTIONS[0].value,
                          onDispositionChange: onOutcomeDispositionChange!,
                          summary: outcomeSummary ?? OUTCOME_DEFAULT_SUMMARY,
                          onSummaryChange: onOutcomeSummaryChange!,
                          onSave: onOutcomeSave!,
                          onCancel: onOutcomeCancel!,
                          callEnded: outcomeCallEnded,
                          showSaveAndRedial: outcomeShowSaveAndRedial,
                          onSaveAndRedial: onOutcomeSaveAndRedial,
                          onSaveAndDismiss: onOutcomeSaveAndDismiss,
                        }
                      : undefined
                  }
                  // Same "current session only" gate as `outcome` above —
                  // see `onDismissChannel`'s own doc comment for why.
                  onDismiss={session.id === lastSessionId ? onDismissChannel : undefined}
                  // Same "whole conversation is read-only" signal `dimmed`
                  // (this component's own prop, see its doc comment) already
                  // is — reused as-is rather than re-derived, so the CURRENT
                  // session's own controls additionally lock down whenever
                  // the whole channel/interaction reads closed, in lockstep
                  // with the exact same condition that already fades this
                  // session's own message content and drives the "closed
                  // interaction"/"channel is closed" banners above.
                  channelClosed={dimmed}
                  // Per explicit bug fix — see `TranscriptSessionSeparator`'s
                  // own `isCurrentSession` doc comment for the full
                  // reasoning: `isClosed` there now derives from THIS
                  // (position), not `session.status`, so there's never more
                  // than one non-Closed-looking session in a Thread.
                  isCurrentSession={session.id === lastSessionId}
                  showActionCluster={showSessionActionCluster}
                  showConsultTransferAndAddParticipant={showSessionConsultTransferAndAddParticipant}
                  showKebabMenu={showSessionKebabMenu}
                  outcomeAfterStatus={sessionOutcomeAfterStatus}
                  showAddParticipant={showSessionAddParticipant}
                  transferInKebabMenu={sessionTransferInKebabMenu}
                  statusAndKebabBeforeOutcome={sessionStatusAndKebabBeforeOutcome}
                  controlsReadOnly={sessionControlsReadOnly}
                  showStatus={showSessionStatus}
                  // Voice/SMS direction-aware icon — see this component's
                  // own doc comment above for the `direction`/`channelType`
                  // props feeding it.
                  channelType={channelType}
                  direction={direction}
                  // Same "current session only" gate as `outcome`/
                  // `onDismiss` above — see this component's own
                  // `isNewThread` prop doc comment for how the caller
                  // resolves it.
                  isNewThread={session.id === lastSessionId && isNewThread}
                  collapsed={collapsedSessionIds.has(session.id)}
                  // Per explicit request, the collapse/expand chevron next
                  // to the "Closed" status tag is hidden for now — not
                  // removed: `collapsedSessionIds`/`toggleSessionCollapsed`
                  // (this component's own state, above) are left fully
                  // intact, and `TranscriptSessionSeparator` itself still
                  // only renders the icon at all when `onToggleCollapsed`
                  // is passed (see that prop's own doc comment) — simply
                  // never passing it here is enough to hide it without
                  // touching either. Restore by reinstating the commented-
                  // out conditional below whenever this comes back.
                  // onToggleCollapsed={
                  //   sessionWithCurrentStatus.status === "Closed"
                  //     ? () => toggleSessionCollapsed(session.id)
                  //     : undefined
                  // }
                  // Reuses the SAME `<768px` reading `transcriptBubbleFullWidth`
                  // already measures off this scroll container (see that
                  // state's own doc comment) rather than a second
                  // ResizeObserver — see `compactHeader`'s own doc comment
                  // on why 768px specifically, and what it does.
                  compactHeader={transcriptBubbleFullWidth}
                />
                )}
                {/* Everything below the separator (mock/live message
                    bubbles, the Voice/Email placeholder) is what actually
                    dims — see `sessionContentDimmed`'s own doc comment
                    above for why this moved off the whole per-session
                    wrapper. Plain wrapper div, not an ancestor of
                    `TranscriptSessionSeparator` above (a SIBLING of this
                    div, same as before) — so its own `sticky top-0` keeps
                    working exactly as already documented there.
                    `w-full max-w-[768px] mx-auto px-6` — per the
                    un-revert back to full width (see the outer scroll
                    container's own doc comment above), the centered
                    column (768px, was 1024px until a later explicit
                    request — "make the max-width of the interaction
                    content 768px instead of 1024px" — narrowed it, along
                    with its two synced siblings below and in
                    agent-next-gen-voice-call-controls.tsx) moved back
                    down onto THIS wrapper, around just the message
                    content — message bubbles are unaffected visually,
                    still centered at the same width and alignment as
                    before; only the separator row above them is full
                    width again.
                    `pb-9` (36px), LAST session only — per explicit follow-up
                    request ("increase the padding-bottom of the
                    conversation container... so the bottom comments are not
                    covered by the fade"): the composer's own soft fade
                    overlay (`-top-8 h-8`, 32px, see that div's own doc
                    comment further down) paints OVER the last ~32px of
                    whichever content is scrolled to the very bottom of the
                    transcript — with only the message blocks' own `py-4`
                    (16px) below the last bubble, the fade's 32px reached up
                    into the actual text of the last message once scrolled
                    all the way down. 36px (a touch more than the fade's own
                    32px) clears it with a little room to spare. Scoped to
                    `session.id === lastSessionId` specifically — every
                    OLDER session already has real content (this session's
                    own separator, or the next session's) sitting below it
                    in the scroll, so only the truly last block in the
                    document needs the extra clearance; adding it to every
                    session would just insert an oversized, unexplained gap
                    above each one's own separator instead. Whichever
                    sub-block actually renders last for this session (canned
                    `messages`, the Voice/Email placeholder, or live
                    messages — see the three blocks below) is covered
                    either way, since this padding lives on their shared
                    parent, not on any one of them individually. */}
                {/* Collapses this session's own message content (below)
                    away as one animated block whenever this session is in
                    `collapsedSessionIds` — same `data-[state=open]:animate-
                    accordion-down`/`data-[state=closed]:animate-accordion-up`
                    mechanism `TranscriptSessionSeparator`'s own Session
                    Details panel already uses, a wholly separate/independent
                    `AccordionHeadless` instance from that one (this session's
                    "Session Details" open/closed state and its "message
                    content collapsed" state are unrelated flags — see
                    `TranscriptSessionSeparator`'s own `collapsed` prop doc
                    comment). Wraps the div below rather than replacing it, so
                    every existing class on that div (the 768px-centered
                    column — see that div's own doc comment for its own
                    history, was 1024px — the dim/opacity transition, the
                    last-session `pb-9`) is untouched — this only adds a
                    height animation around it. Still a DOM descendant of the
                    outer `<div key={session.id}>` either way, so
                    `TranscriptSessionSeparator`'s own `sticky top-0` keeps
                    working exactly as already documented there (a fully
                    collapsed session legitimately has nothing left to stick
                    through, which is the correct behavior here). */}
                <AccordionHeadless
                  type="single"
                  collapsible
                  value={sessionRowOnly || collapsedSessionIds.has(session.id) ? "" : session.id}
                  onValueChange={() => {}}
                >
                <AccordionHeadlessItem value={session.id} className="border-none">
                <AccordionHeadlessContent>
                <div
                  // The session's content stack. `pt-4`: the stack owns the space under the
                  // session row, whatever comes first (the Autosummary, an approval, the
                  // transcript); its blocks own only the space below them (`pb-4`).
                  data-slot="content-stack"
                  // `max-w-[768px]` — per explicit request ("make the
                  // max-width of the interaction content 768px instead of
                  // 1024px"), narrowed from 1024px, itself narrowed down
                  // from the previous 1200px (see this wrapper's own
                  // top-of-block doc comment above for the full "why 1200px
                  // lived here at all" history). The composer's own matching
                  // wrapper (`InteractionComposer`, further down this file)
                  // and `VoiceCallControls`' own floating card
                  // (agent-next-gen-voice-call-controls.tsx) are kept in
                  // sync at the same 768px so the message column, the input
                  // box below it, and the voice controls bar all stay the
                  // same width.
                  className={cn(
                    "w-full max-w-[768px] mx-auto px-6 pt-4",
                    sessionContentDimmed && "opacity-50 transition-opacity",
                    session.id === lastSessionId && "pb-9"
                  )}
                >
                {/* Only on the CURRENT session — see `contactOverview`'s own
                    doc comment above; a reopened/historical session under
                    this same channel already has real messages of its own,
                    not a fresh-launch moment to summarize.
                    `contactOverviewAtBottom` additionally gates WHICH of the
                    two spots below actually renders it (per explicit
                    request): a genuinely brand-new, empty conversation
                    shows it up here, first thing the agent reads before
                    anything else exists to read. A channel that was picked
                    up already carrying a conversation — a transfer, or any
                    other "existing conversation" case the bottom spot
                    covers (this app has no separate transferred flag; a
                    transferred-in channel looks identical to a resumed
                    one, some pre-existing messages already sitting on it —
                    see `contactOverviewPosition`'s own doc comment for the
                    one scripted exception, Marcus Webb, that still needs
                    the bottom spot despite `isFreshLaunch` reading `true`
                    for him) — shows it at the OTHER spot instead, just
                    above the live-messages block below, so the agent reads
                    the existing history first and this summary lands right
                    where their own new messages are about to continue
                    from. */}
                {(contactOverview || customerContextOverview) &&
                  session.id === lastSessionId &&
                  !contactOverviewAtBottom &&
                  !overviewBeforeApproval &&
                  renderContactOverviewBlock(true)}
                {messages.length > 0 && (
                  <div className="flex min-w-0 flex-col gap-5 pb-4">
                    {messages.map((message) => (
                      <TranscriptMessageBubble
                        key={message.id}
                        message={
                          message.sender === "customer"
                            ? { ...message, name: displayName, initials: displayInitials }
                            : message
                        }
                        customerIdentified={customerIdentified}
                        tagPickerOpen={tagPickerOpenId === message.id}
                        onTagPickerOpenChange={(open) => setTagPickerOpenId(open ? message.id : null)}
                        onAddTag={(option) => addTag(session.id, message.id, option)}
                        onRemoveTag={(tagId) => removeTag(session.id, message.id, tagId)}
                        onClearTags={() => clearTags(session.id, message.id)}
                        onCopy={() => copyMessage(message.text)}
                        narrow={transcriptNarrow}
                      />
                    ))}
                  </div>
                )}
                {/* Email has no designed message-by-message transcript
                    content yet (an email thread UI) — a plain placeholder
                    stands in for it under this session's own separator,
                    same as before this session info was added for this
                    channel, just no longer replacing the separator/Session
                    Details too (see `TRANSCRIPT_SESSIONS_EMAIL`'s own doc
                    comment). Keyed off `messages.length === 0` rather than
                    unconditionally for this channel type so a future
                    session that *does* get real messages seeded onto it
                    (e.g. once an email transcript is designed) stops
                    showing this the moment it has any. Voice no longer
                    shows this placeholder — a live call now renders the
                    real `VoiceCallControls` bar below the transcript
                    instead of an empty "Coming Soon" body, per explicit
                    request. */}
                {messages.length === 0 && channelType === "email" && (
                  <div className="flex items-center justify-center pt-8 pb-12">
                    <p className="lyra-body-md text-lyra-fg-secondary">
                      Coming Soon Email Content
                    </p>
                  </div>
                )}
                {/* Live messages — this interaction's own sent/received
                    messages (see `Interaction.liveMessages`'s own doc
                    comment) — rendered here, INSIDE this session's own
                    per-session block, not as a separate block after this
                    whole `.map()` (where it used to live). Sliced per-
                    session via `liveMessagesBySessionId` (see that const's
                    own doc comment) rather than always attaching the whole
                    flat array to `lastSessionId` — per explicit correction,
                    reopening a closed channel keeps its PRIOR messages
                    visible under their original session (dimmed, above),
                    with only newly-sent messages landing under the current
                    one. Still no separator of its own — it's a continuation
                    of the same session's conversation, not a new session —
                    but it has to be a DOM descendant of this same
                    `<div key={session.id}>` for `TranscriptSessionSeparator`'s
                    `sticky top-0` above to actually work once live messages
                    are what's overflowing: a `position: sticky` element can
                    only stick for as long as its OWN containing block still
                    has height below it to scroll through. With live
                    messages rendered as a sibling of this whole block
                    instead of inside it, the fresh-launch session's own
                    container held nothing but the separator itself (its
                    real `messages` array is empty — the conversation is
                    entirely live), so that container's height was
                    essentially zero and the separator unstuck itself almost
                    immediately — sticky worked for the fixed mock sessions
                    (separator + real messages sharing one container) but
                    not for a brand-new conversation (per explicit report:
                    "sticky for existing conversations but new conversations
                    ... when the conversation reaches an overflow-y it is
                    not sticky"). */}
                {/* The OTHER `ContactOverview` spot — see the doc comment on
                    its sibling occurrence above this session's `messages`
                    block for the full "which of the two spots" reasoning.
                    This one covers a transfer/existing-conversation pickup
                    (`contactOverviewAtBottom`): it renders AFTER this session's own
                    existing message history — the `messages.map(...)`/
                    Voice-Email-placeholder blocks above AND the "already
                    existed" slice of live messages just below (see
                    `contactOverviewLiveMessageBoundaryRef`'s own doc
                    comment for why live messages need their own split
                    here too) — and BEFORE the "new" slice, so it reads as
                    the boundary between "what already happened on this
                    conversation" and "what the agent sends from here." */}
                {(() => {
                  const sessionLiveMessages = liveMessagesBySessionId[session.id] ?? [];
                  const isNonFreshOverviewSession =
                    !!(contactOverview || customerContextOverview) && session.id === lastSessionId && contactOverviewAtBottom;
                  const existingLiveMessages = isNonFreshOverviewSession
                    ? sessionLiveMessages.slice(0, contactOverviewLiveMessageBoundaryRef.current)
                    : sessionLiveMessages;
                  const newLiveMessages = isNonFreshOverviewSession
                    ? sessionLiveMessages.slice(contactOverviewLiveMessageBoundaryRef.current)
                    : [];
                  // Only the CURRENT session's own trailing edge — see
                  // `isCustomerTyping`'s own doc comment above for the full
                  // `lastSessionId`/`isTextChannel` scoping reasoning.
                  const showTypingIndicator = session.id === lastSessionId && isTextChannel && isCustomerTyping;
                  const showAiTypingIndicator = session.id === lastSessionId && isTextChannel && isAiTyping;
                  const renderBubble = (message: TranscriptMessage) => (
                    <TranscriptMessageBubble
                      key={message.id}
                      message={{
                        ...message,
                        ...(message.sender === "customer" ? { name: displayName, initials: displayInitials } : {}),
                        tags: liveMessageTags[message.id] ?? message.tags,
                      }}
                      customerIdentified={customerIdentified}
                      tagPickerOpen={tagPickerOpenId === message.id}
                      onTagPickerOpenChange={(open) => setTagPickerOpenId(open ? message.id : null)}
                      onAddTag={(option) => addLiveTag(message.id, option)}
                      onRemoveTag={(tagId) => removeLiveTag(message.id, tagId)}
                      onClearTags={() => clearLiveTags(message.id)}
                      onCopy={() => copyMessage(message.text)}
                      narrow={transcriptNarrow}
                    />
                  );
                  // Per explicit request ("style the transcript like the
                  // contact history call transcripts") — see
                  // `TranscriptPlainLine`'s own doc comment for the full
                  // "why voice only, why a separate component from
                  // `ContactHistoryTranscriptLine`". Same customer-identity
                  // override `renderBubble` applies above (`displayName`),
                  // just fed to the plain line instead of `ChatMessage`.
                  const renderPlainLine = (message: TranscriptMessage) => (
                    <TranscriptPlainLine
                      key={message.id}
                      name={message.sender === "customer" ? displayName : message.name}
                      timestamp={message.timestamp}
                      text={message.text}
                    />
                  );
                  const renderLiveMessage = (message: TranscriptMessage) => {
                    const aiCardHandlers = { onApprovalDecision, onApprovalCallRequest, onApprovalSuggestionAsk, approvalTakenOver, onWrapUpComplete, onSnapshotLink, activeSnapshotLink };
                    const rendered = message.instruction || message.wrapUp || message.saveAddress ? (
                      <AiActionCard key={message.id} message={message} {...aiCardHandlers} />
                    ) : message.summary ? (
                      <div key={message.id} className="flex flex-col gap-5">
                        {overviewBeforeApproval && session.id === lastSessionId && liveMessages.find((m) => !!m.summary)?.id === message.id && renderContactOverviewBlock()}
                        <AiActionCard message={message} {...aiCardHandlers} />
                      </div>
                    ) : message.event ? (
                      <div key={message.id} className="flex flex-col gap-0.5">
                        <span className="lyra-body-sm text-lyra-fg-secondary">
                          {message.timestamp} · {message.name}
                        </span>
                        <span className="lyra-body-md-emphasis text-lyra-fg-default">{message.text}</span>
                      </div>
                    ) : channelType === "voice" ? (
                      renderPlainLine(message)
                    ) : (
                      renderBubble(message)
                    );
                    const isAiAction = !!(message.instruction || message.wrapUp || message.summary || message.saveAddress || message.event);
                    const entered = initialMessageIdsRef.current?.has(message.id) ? (
                      rendered
                    ) : (
                      <div key={message.id} className="animate-in slide-in-from-bottom-4 fade-in-0 duration-200">
                        {rendered}
                      </div>
                    );
                    return isAiAction ? (
                      <AiActionCollapse key={message.id} hidden={hideAiActions} gap>
                        {entered}
                      </AiActionCollapse>
                    ) : (
                      entered
                    );
                  };
                  return (
                    <>
                      {existingLiveMessages.length > 0 && (
                        <div className="flex flex-col gap-5 pb-4">
                          {existingLiveMessages.map(renderLiveMessage)}
                        </div>
                      )}
                      {isNonFreshOverviewSession && renderContactOverviewBlock(true)}
                      {(newLiveMessages.length > 0 || showTypingIndicator || showAiTypingIndicator) && (
                        <div className="flex flex-col gap-5 pb-4">
                          {newLiveMessages.map(renderLiveMessage)}
                          {showTypingIndicator && (
                            <div className="animate-in slide-in-from-bottom-4 fade-in-0 duration-200">
                            <TypingIndicator
                              initials={displayInitials}
                              identified={customerIdentified}
                              narrow={transcriptNarrow}
                              bubbleFullWidth={transcriptBubbleFullWidth}
                            />
                            </div>
                          )}
                          {showAiTypingIndicator && (
                            <div className="animate-in slide-in-from-bottom-4 fade-in-0 duration-200">
                            <TypingIndicator
                              ai
                              initials="AI"
                              narrow={transcriptNarrow}
                              bubbleFullWidth={transcriptBubbleFullWidth}
                            />
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  );
                })()}
                </div>
                </AccordionHeadlessContent>
                </AccordionHeadlessItem>
                </AccordionHeadless>
              </div>
            );
          })}
          {/* Content after the conversation, scrolling with it (e.g. the
              voice wrap-up card, P0.5d.1) — see `trailingContent`. */}
          {trailingContent && !sessionRowOnly && (
            <div ref={trailingContentRef} className="w-full max-w-[768px] mx-auto px-6 pt-2 pb-4">
              {trailingContent}
            </div>
          )}
          {/* See `bottomSentinelRef`'s own declaration (above) — the
              scroll-to-bottom-on-open effect's `scrollIntoView` target.
              Zero-size, purely a scroll anchor — must stay the LAST node
              in this column so "the bottom" always means the true end of
              the rendered content, not wherever the last session/message
              happened to end. */}
          <div ref={bottomSentinelRef} />
        </div>
      </div>
      {/* Per explicit request ("if you scroll up in the transcript, add a
          sync to live button that scrolls to the bottom of the transcript
          (match the lyra style)"): voice gets its own floating scroll-to-
          bottom affordance here — originally its own "Sync to Live" label
          in a solid `variant="default"` button, later corrected per
          explicit follow-up to read "Scroll To Latest" in the same
          `outline` style the non-voice button below uses, for consistency
          across channels. Still no "N New" badge (voice's live transcript
          has no per-message unread count to show — see `newMessageCount`'s
          own doc comment, which is chat/SMS/WhatsApp-specific). Same
          `scrollToBottom` the "Scroll To Latest" button below calls — see
          that function's own doc comment.
          `sticky`, NOT `absolute` like the "Scroll To Latest" version
          below — per explicit bug report ("the button should not scroll -
          it is currently scrolling"). `absolute` anchors to the nearest
          `position`-ed ancestor, which for the main record column (the
          "Scroll To Latest" button's only real-world context — see
          `channelType`'s own gate on the docked-panel "Transcript" tab,
          voice-only) is a `relative` wrapper that ITSELF never scrolls
          (only `scrollContainerRef`, ITS un-ancestor sibling, does) — so
          anchoring to it correctly reads as "pinned to the viewport while
          content scrolls underneath." Voice's OWN real-world context is
          the opposite: this whole subtree (the `relative` wrapper AND
          `scrollContainerRef`) sits INSIDE an ancestor that's already
          scrollable itself (lyra-ui's `PanelContent`, or this file's own
          hand-rolled preview wrapper — see `scrollToBottom`'s own doc
          comment for the full "why" `scrollContainerRef` isn't the real
          scroll container there), so `absolute` there anchors to a box
          that scrolls right along with everything else — reading as "this
          button is scrolling," exactly the bug reported. `sticky bottom-4`
          instead resolves against whichever ancestor genuinely has
          `overflow` set (walking straight past this `relative`/`overflow-
          hidden`-only wrapper to `PanelContent`/the preview wrapper,
          `scrollContainerRef`'s `overflow-y-auto` never entering into it
          since it's a sibling, not an ancestor, of this button) — so it
          correctly stays pinned to the panel's own bottom edge instead.
          `-mb-9` cancels out the height `sticky` (unlike `absolute`) adds
          back into the document's normal flow — exactly this button's own
          rendered height (`size="lg"` → `h-9`) — so it still floats over
          the last message rather than pushing it up and leaving a gap. */}
      {!isAtBottom && channelType === "voice" && (
        <div className="pointer-events-none sticky bottom-4 z-[2] -mb-9 flex justify-center">
          <Button
            variant="outline"
            size="lg"
            onClick={scrollToLatest}
            className="pointer-events-auto rounded-full bg-lyra-bg-surface-base text-lyra-fg-default shadow-lg"
          >
            <ArrowDown className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
            Scroll To Latest
          </Button>
        </div>
      )}
      {!isAtBottom && channelType !== "voice" && (
        <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center">
          <Button
            variant="outline"
            size="lg"
            onClick={scrollToLatest}
            className="pointer-events-auto rounded-full bg-lyra-bg-surface-base text-lyra-fg-default shadow-lg"
          >
            <ArrowDown className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
            Scroll To Latest
            {newMessageCount > 0 && (
              <Badge color="slate" variant="solid">
                {newMessageCount} New
              </Badge>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

/* ── Quick replies ──
   Canned-response data for `InteractionComposer`'s "/trigger" picker
   (`QuickReplyMenu`/`QuickReplyVariableForm`, both lyra-ui exports) — app-
   local business content, same "reusable UI in lyra-ui, real data in the
   app" split as `CONTACT_HISTORY`/`CREATE_NEW_CUSTOMERS` and everything
   else in this file that isn't generic across every lyra-ui consumer.

   `rich`/`fields` items need a value chosen for each `{token}` in their
   `template` before they make sense to send (a business-day range, a
   department, a date/time) — `InteractionComposer` swaps the matching
   list for `QuickReplyVariableForm` to collect those, keyed by each
   field's own `key`, which must match a `{key}` token in `template`
   exactly (see `fillQuickReplyTemplate` below). Plain (non-`rich`) items
   have no `fields` at all and insert `template` verbatim. */
export interface QuickReplyItem {
  /** The id typed after `QUICK_REPLY_TRIGGER_CHAR` to reach this item */
  id: string;
  title: string;
  /** May contain `{key}` tokens matching `fields[].key`, for a `rich` item */
  template: string;
  rich?: boolean;
  fields?: QuickReplyField[];
}

export const QUICK_REPLIES: QuickReplyItem[] = [
  { id: "greeting", title: "Greeting", template: "Thank you for contacting us. How can I assist you today?" },
  { id: "acknowledge", title: "Acknowledge", template: "Hello. Thank you for contacting us.  I would be happy to look into that for you." },
  { id: "account", title: "Request Account #", template: "Could you please provide me with your account number?" },
  { id: "reviewed", title: "Account Reviewed", template: "I've reviewed your account and I can see the issue." },
  { id: "escalate", title: "Escalate", template: "I'm escalating this to our specialist team right away." },
  {
    id: "timeline",
    title: "Processing Time",
    template: "Please allow {days} business days for this to take effect.",
    rich: true,
    fields: [
      {
        key: "days",
        label: "Business Days",
        type: "select",
        options: [
          { value: "1–2", label: "1–2" },
          { value: "3–5", label: "3–5" },
          { value: "5–7", label: "5–7" },
          { value: "7–10", label: "7–10" },
        ],
      },
    ],
  },
  { id: "closing", title: "Closing", template: "Is there anything else I can help you with today?" },
  {
    id: "success",
    title: "Request Success",
    template: "Your {requestType} has been processed successfully.",
    rich: true,
    fields: [{ key: "requestType", label: "Request Type", type: "text", placeholder: "e.g. refund request" }],
  },
  {
    id: "callback",
    title: "Schedule Callback",
    template: "I'll arrange a callback on {date} at {time} for you.",
    rich: true,
    fields: [
      { key: "date", label: "Date", type: "date" },
      { key: "time", label: "Time", type: "time" },
    ],
  },
  {
    id: "transfer",
    title: "Transfer Notice",
    template: "I'm transferring you to {department}. Please hold for a moment.",
    rich: true,
    fields: [
      {
        key: "department",
        label: "Department",
        type: "select",
        options: [
          { value: "Billing", label: "Billing" },
          { value: "Technical Support", label: "Technical Support" },
          { value: "Retention", label: "Retention" },
          { value: "Escalations", label: "Escalations" },
          { value: "Account Management", label: "Account Management" },
        ],
      },
    ],
  },
  { id: "thankyou", title: "Thank You", template: "Thank you so much for your patience. We really appreciate it!" },
  { id: "sorry", title: "Apology", template: "I sincerely apologize for the inconvenience this has caused you." },
];

// Message ids whose "performing" step already played, so remounting (switching customers) doesn't replay the spinner.
const finishedInstructionIds = new Set<string>();

/** "AI agent is performing this now…" spinner for ~1.8s, then "AI agent finished performing this." plus the clickable instruction row. */
/** Collapses its children (fade + slide up + height to 0) when `hidden`, the reverse of the entrance animation. `gap` cancels the parent's flex gap while collapsed. */
function AiActionCollapse({ hidden, gap, children }: { hidden?: boolean; gap?: boolean; children: React.ReactNode }) {
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

export function InstructionInterstitial({
  id,
  instruction,
  timestamp,
  onOpen,
  active,
}: {
  /** True while this row's panel is the one open in the side panel (same selected look as Marcus's action-log rows). */
  active?: boolean;
  id: string;
  instruction: { title: string; by: string; link: string };
  timestamp: string;
  onOpen: (link: string) => void;
}) {
  const [done, setDone] = useState(finishedInstructionIds.has(id));
  useEffect(() => {
    if (done) return;
    const t = window.setTimeout(() => {
      finishedInstructionIds.add(id);
      setDone(true);
    }, 1800);
    return () => window.clearTimeout(t);
  }, [done, id]);
  return (
    <Interstitial
      title={instruction.title}
      by={instruction.by}
      timestamp={timestamp}
      pending={!done}
      active={active}
      onOpen={() => onOpen(instruction.link)}
    />
  );
}

/** Fills a `rich` item's `template` from its current field values —
 *  `bracket` wraps each filled-in value in `[...]` (matching the reference
 *  mockup's own preview treatment, e.g. "Please allow [1–2] business
 *  days...") for the live preview shown while still editing; the final
 *  text actually inserted into the composer (`bracket: false`) has no
 *  brackets, since those were only ever a preview affordance marking which
 *  parts of the sentence came from a field. Plain (non-`rich`) items never
 *  reach this — their `template` has no `fields`/tokens to fill and is
 *  used as-is. */
export function fillQuickReplyTemplate(
  item: QuickReplyItem,
  values: Record<string, string | Date | undefined>,
  bracket: boolean
): string {
  if (!item.fields) return item.template;
  return item.fields.reduce((text, field) => {
    const display = quickReplyFieldDisplayValue(field, values[field.key]);
    const shown = bracket && display !== `{${field.key}}` ? `[${display}]` : display;
    return text.split(`{${field.key}}`).join(shown);
  }, item.template);
}

/* ── InteractionComposer ──
   The message-input bar fixed to the bottom of an active interaction's
   detail page — a sibling rendered right after `InteractionTranscript`
   rather than living inside it, so it's a `shrink-0` row in the same flex
   column instead of scrolling away with the transcript above it (which is
   the `flex-1 overflow-y-auto` element doing all the scrolling).

   Composed from existing lyra-ui exports (`Textarea`, `Button`,
   `ActionIconButton`) plus the two new `QuickReplyMenu`/
   `QuickReplyVariableForm` exports for the "/trigger" quick-reply picker
   (see the "Quick replies" data block above this component). The "Send ▾"
   control is hand-built from two adjacent `Button`s (rounded-r-none /
   rounded-l-none, a hairline divider between) since lyra-ui has no
   dedicated split-button component; same reasoning as everywhere else in
   this file that composes existing atoms rather than waiting on a new
   lyra-ui primitive.

   Quick-reply mechanics: typing `/` (`QUICK_REPLY_TRIGGER_CHAR` below —
   `/` rather than `#`, per explicit request: it's the near-universal
   chat-command convention, e.g. Slack/Discord/Front/Intercom/Zendesk,
   where `#` almost always means a hashtag/channel instead) followed by
   any run of word characters with the caret still immediately after them
   (`QUICK_REPLY_TRIGGER_PATTERN` below, re-tested against the text up to
   the caret on every keystroke) opens the menu, filtered to items whose
   `id`/`title` contains what's typed so far; the (existing, previously
   unwired) "Quick replies" toolbar button opens the same menu at the
   current caret with no filter instead, for agents who'd rather browse
   than type a shortcut from memory. `quickReplyTriggerStart` records
   where the inserted/replaced range begins — either the `/`'s own
   position (typed trigger) or the bare caret (toolbar button, nothing to
   replace, pure insert). The menu itself owns no keyboard state (see
   `QuickReplyMenu`'s own doc comment) — arrow keys/Enter/Escape are all
   handled by this component's `onKeyDown` on the `Textarea` itself, so
   the textarea never loses focus/caret position while browsing. Selecting
   a plain item inserts `template` immediately; selecting a `rich` one
   swaps the same on-screen spot to `QuickReplyVariableForm` instead of
   closing, so the agent can fill in its field(s) — see
   `fillQuickReplyTemplate`'s own doc comment for the bracketed-preview-
   vs-final-insert distinction — before either inserting or cancelling
   back out (Cancel closes the whole picker rather than returning to the
   list, same "start over from `/`" flow either way).

   `onSend` hands the typed text up to `handleSendMessage` (the main
   component, where `interactions`/`setInteractions` actually live — this
   component has no access to that state itself) — that's what pushes the
   message into the active interaction's `liveMessages` and schedules the
   simulated customer reply. This component still owns nothing but the
   input's own text (and now the quick-reply picker's transient state);
   it doesn't know or care what happens to a message once sent. */
export const QUICK_REPLY_TRIGGER_CHAR = "/";
export const QUICK_REPLY_TRIGGER_PATTERN = /\/(\w*)$/;
/**
 * The composer's soft top fade instead of a hard border-top — reads as the
 * content scrolling *under* the composer rather than stopping at a line.
 * Positioned outside its parent's box (negative top, the parent must be
 * `relative`), so it overlays the last 32px of the scrolling content above.
 * Used by the inline composer and by the docked panel composer's footer;
 * `toClassName` is the background it fades into (the surface behind it).
 */
/** The AI cards' shared enter animation (AI messages, approvals, the
 *  Autosummary): on mount, and on a card switch where the caller keys it. */
export const AI_CARD_ENTER = "animate-in slide-in-from-bottom-4 fade-in-0 duration-200";

export function ComposerFade({ toClassName = "to-lyra-bg-surface-base" }: { toClassName?: string }) {
  return (
    <div
      data-slot="composer-fade"
      className={cn("pointer-events-none absolute inset-x-0 -top-8 h-8 bg-gradient-to-b from-transparent", toClassName)}
      aria-hidden="true"
    />
  );
}

export function InteractionComposer({
  onSend,
  prefill,
  onPrefillConsumed,
  copilotSuggestions,
  copilotSuggestionLinks,
  copilotSuggestionReplacements,
  onCopilotSuggestionLink,
  onCopilotAsk,
  copilotOnly,
  onTakeover,
  takeoverLabel = "Takeover Chat",
  takeoverDisabled,
  takeoverDisabledReason,
  hideAiActions,
  onHideAiActionsChange,
  copilotDock,
  floatingMenus = false,
  replyBlockedReason,
}: {
  /** Set while the agent's own state blocks replying (presence): the chat
   *  input, Send and the quick-reply trigger stay visible but disabled, under
   *  an InlineNotification reading this. The transcript stays readable. */
  replyBlockedReason?: string;
  /** The quick-reply menu (and its variable form) float on the document's
   *  top layer, anchored above the composer, instead of in its flow: for a
   *  composer inside a size-limited surface (a header hover preview) that
   *  would clip it. The layer is tagged `data-floating-layer`. */
  floatingMenus?: boolean;
  /** Settings → AI display "In the Contact Details panel": the Ask Copilot
   *  part (chips, input, Takeover) renders as the panel's docked footer
   *  (portaled into `mount`) instead of here; this composer keeps only the
   *  chat input. While `mount` is null (the panel isn't showing its Overview)
   *  the Copilot part isn't rendered anywhere. */
  copilotDock?: { mount: HTMLElement | null };
  /** Shows a "Hide AI Actions" switch at the right of the mode toggle row. */
  hideAiActions?: boolean;
  onHideAiActionsChange?: (hide: boolean) => void;
  takeoverLabel?: string;
  takeoverDisabled?: boolean;
  takeoverDisabledReason?: string;
  /** Show only the Ask Copilot input (no Chat with Customer toggle) — used while the agent is reviewing an AI-led chat. */
  copilotOnly?: boolean;
  /** With `copilotOnly`: shows a "Take over" button in place of the toggle. */
  onTakeover?: () => void;
  /** Suggestion chips shown under the "Ask Copilot" input; clicking one fills the question. */
  copilotSuggestions?: string[];
  /** label → link key for chips that open a side panel (after a brief spinner) instead of filling the input. */
  copilotSuggestionLinks?: Record<string, string>;
  /** A used link chip is swapped for this replacement (label → replacement label). */
  copilotSuggestionReplacements?: Record<string, string>;
  onCopilotSuggestionLink?: (link: string) => void;
  /** Fired whenever the agent asks Copilot something (submits a question, or uses a chip that runs a lookup) —
   *  the caller adds a matching interstitial row to the chat. */
  onCopilotAsk?: (text: string) => void;
  onSend: (text: string) => void;
  /** Populates the composer's own text WITHOUT sending it — per explicit
   *  request ("When one is clicked it should populate into the input but
   *  not send until the agent clicks send"), for Copilot's suggested-reply
   *  cards (currently only Marcus Webb's scripted scenario,
   *  `AgentWorkspace2WithDeskPage.tsx`). This component still owns its own
   *  `message` state (unchanged, uncontrolled) — `prefill` is a one-shot
   *  injection into that state via the `useEffect` below, not a switch to a
   *  fully controlled input: the agent can still freely edit/clear the
   *  populated text afterward like anything else they typed themselves.
   *  Left `undefined` by every OTHER caller (no behavior change for them). */
  prefill?: string;
  /** Fired the instant `prefill` is consumed (copied into `message`) — the
   *  caller's cue to reset its own `prefill` value back to `undefined`.
   *  Required so a SECOND, later `prefill` call can ever take effect at
   *  all: the effect below is keyed on `[prefill]`, so if the caller left
   *  its own prefill value sitting non-`undefined` after the first one
   *  landed, setting the exact same string again wouldn't change that
   *  dependency and the effect simply wouldn't refire. Resetting to
   *  `undefined` in between means every distinct suggestion the agent
   *  clicks — even if it happens to be identical text — reliably re-fires
   *  this effect. */
  onPrefillConsumed?: () => void;
}) {
  const [composerTabState, setComposerTab] = useState<"chat" | "copilot">("chat");
  const copilotDocked = !!copilotDock;
  const composerTab = copilotDocked ? "chat" : copilotOnly ? "copilot" : composerTabState;
  const [copilotQuestion, setCopilotQuestion] = useState("");
  const [copilotLoading, setCopilotLoading] = useState<string | null>(null);
  // Switching modes puts the caret straight into that mode's input so the agent can just start typing
  // (skipped on first mount so the composer doesn't steal focus when it appears).
  const copilotPaneRef = useRef<HTMLDivElement>(null);
  // Focus only when the agent actually switches modes with the toggle: compare against the previous tab so mount
  // (and dev double-invoked effects) never steal focus.
  const prevComposerTab = useRef(composerTab);
  useEffect(() => {
    if (prevComposerTab.current === composerTab) return;
    prevComposerTab.current = composerTab;
    if (composerTab === "chat") {
      textareaRef.current?.focus();
    } else {
      copilotPaneRef.current?.querySelector<HTMLElement>("textarea, input")?.focus();
    }
  }, [composerTab]);
  const [copilotUsed, setCopilotUsed] = useState<string[]>([]);
  const activateCopilotSuggestion = (suggestion: string) => {
    const link = copilotSuggestionLinks?.[suggestion];
    if (!link) {
      setCopilotQuestion(suggestion);
      return;
    }
    if (copilotLoading) return;
    setCopilotLoading(suggestion);
    onCopilotAsk?.(suggestion);
    window.setTimeout(() => {
      setCopilotLoading(null);
      setCopilotUsed((prev) => [...prev, suggestion]);
      onCopilotSuggestionLink?.(link);
    }, 1400);
  };
  const [message, setMessage] = useState("");
  const canSend = message.trim().length > 0;
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // See `prefill`'s own doc comment above for the full "why" — this just
  // performs the one-shot injection + focus, then immediately hands control
  // back to the caller to reset `prefill` to `undefined` again.
  useEffect(() => {
    if (prefill === undefined) return;
    setMessage(prefill);
    setComposerTab("chat");
    onPrefillConsumed?.();
    // The textarea's own auto-grow (further down this component, if any)
    // and caret placement both need the DOM to have actually committed
    // `message`'s new value first.
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      el?.focus();
      el?.setSelectionRange(prefill.length, prefill.length);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefill]);
  // Per explicit request: tabbing out of the message textarea should land
  // on the Send button first — not the toolbar's Attach/Bold/Italic/etc.
  // icon buttons, which sit BEFORE Send in visual/DOM order (see the render
  // below) and so would otherwise be next in line for a plain, un-messed-
  // with browser Tab order. `handleComposerKeyDown` intercepts Tab on the
  // textarea itself and focuses this directly instead of letting the
  // browser's default order run.
  const sendButtonRef = useRef<HTMLButtonElement>(null);

  // ── Quick-reply picker state ──
  // `quickReplyTriggerStart` is the message-text index the eventually-
  // inserted text replaces through to the caret at insert time — either
  // where the typed trigger character itself sits (so "/time" gets
  // replaced outright),
  // or the bare caret position when opened via the toolbar button instead
  // (nothing typed to replace, a pure insert at that point). `null` means
  // closed. See this component's own doc comment above for the full flow.
  const [quickReplyTriggerStart, setQuickReplyTriggerStart] = useState<number | null>(null);
  const [quickReplyQuery, setQuickReplyQuery] = useState("");
  const [quickReplyActiveIndex, setQuickReplyActiveIndex] = useState(0);
  // Non-null while showing `QuickReplyVariableForm` for a `rich` item
  // instead of the plain matching list — same overlay slot, different
  // content (see the render below).
  const [quickReplyConfiguring, setQuickReplyConfiguring] = useState<QuickReplyItem | null>(null);
  const [quickReplyFieldValues, setQuickReplyFieldValues] = useState<Record<string, string | Date | undefined>>({});
  const quickReplyOpen = quickReplyTriggerStart !== null;
  const quickReplyContainerRef = useRef<HTMLDivElement>(null);

  const quickReplyMatches = useMemo(() => {
    const q = quickReplyQuery.trim().toLowerCase();
    if (!q) return QUICK_REPLIES;
    return QUICK_REPLIES.filter(
      (item) => item.id.toLowerCase().includes(q) || item.title.toLowerCase().includes(q)
    );
  }, [quickReplyQuery]);

  const closeQuickReplyMenu = () => {
    setQuickReplyTriggerStart(null);
    setQuickReplyQuery("");
    setQuickReplyActiveIndex(0);
    setQuickReplyConfiguring(null);
    setQuickReplyFieldValues({});
  };

  // Dismiss on outside click — this menu is a plain absolutely-positioned
  // overlay, not a `Popover` (see this component's own doc comment for
  // why: the `Textarea` itself must keep focus/caret while browsing, which
  // rules out a focus-trapping Radix popover). `mousedown` (not `click`)
  // so this fires before a menu-row's own `onClick` — the row's click
  // handler still runs normally afterward since it's inside
  // `quickReplyContainerRef` and skipped here.
  //
  // The `[data-radix-popper-content-wrapper]` check covers
  // `QuickReplyVariableForm`'s own `Select`/`DatePicker`/`TimePicker`
  // fields — Radix always portals THEIR dropdown/calendar content
  // straight to `document.body`, outside `quickReplyContainerRef`'s own
  // DOM subtree, no matter how deeply nested those fields are inside it.
  // Without this, picking e.g. a Business Days option registered as an
  // "outside" click and closed the whole rich form before the selection
  // even landed — confirmed live. Every Radix popper-positioned surface
  // (`Popover`/`Select`/`DropdownMenu`/etc., all built on
  // `@radix-ui/react-popper`) tags its own wrapper with this attribute,
  // so this isn't specific to any one field type.
  useEffect(() => {
    if (!quickReplyOpen) return;
    const handlePointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (quickReplyContainerRef.current?.contains(target)) return;
      if (target instanceof Element && target.closest("[data-radix-popper-content-wrapper], [data-floating-layer]")) return;
      closeQuickReplyMenu();
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [quickReplyOpen]);
  // `floatingMenus`: where the floating menu sits (above the composer, as
  // wide as it or wider, up to the viewport's top).
  const composerRootRef = useRef<HTMLDivElement>(null);
  const [floatingMenuBox, setFloatingMenuBox] = useState<React.CSSProperties | null>(null);
  useLayoutEffect(() => {
    if (!floatingMenus || !quickReplyOpen || !composerRootRef.current) {
      setFloatingMenuBox(null);
      return;
    }
    const rect = composerRootRef.current.getBoundingClientRect();
    const width = Math.max(rect.width, 440);
    setFloatingMenuBox({
      position: "fixed",
      left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)),
      bottom: window.innerHeight - rect.top + 8,
      width,
      maxHeight: Math.max(160, rect.top - 16),
      overflowY: "auto",
      zIndex: 60,
    });
  }, [floatingMenus, quickReplyOpen]);
  const placeMenu = (menu: React.ReactElement) =>
    floatingMenus
      ? floatingMenuBox &&
        createPortal(
          <div data-floating-layer="" style={floatingMenuBox} className="rounded-lyra-lg shadow-lg">
            {menu}
          </div>,
          document.body,
        )
      : menu;

  // Replaces `[quickReplyTriggerStart, caret)` — the typed "/query" (or,
  // for the toolbar-button path, a zero-length range right at the caret)
  // — with `text`, then restores focus with the caret placed right after
  // the newly-inserted text. `requestAnimationFrame` — the caret can only
  // be repositioned after React actually commits the new `value` to the
  // DOM `<textarea>`, which hasn't happened yet inside this same handler.
  const insertQuickReplyText = (text: string) => {
    const el = textareaRef.current;
    const start = quickReplyTriggerStart ?? el?.selectionStart ?? message.length;
    const end = el?.selectionStart ?? message.length;
    const next = message.slice(0, start) + text + message.slice(end);
    setMessage(next);
    const caret = start + text.length;
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(caret, caret);
    });
  };

  const handleSelectQuickReply = (item: QuickReplyItem) => {
    if (item.rich) {
      setQuickReplyConfiguring(item);
      setQuickReplyFieldValues({});
      return;
    }
    insertQuickReplyText(item.template);
    closeQuickReplyMenu();
  };

  const handleInsertRichQuickReply = () => {
    if (!quickReplyConfiguring) return;
    insertQuickReplyText(fillQuickReplyTemplate(quickReplyConfiguring, quickReplyFieldValues, false));
    closeQuickReplyMenu();
  };

  const openQuickReplyMenuAtCaret = () => {
    const el = textareaRef.current;
    setQuickReplyTriggerStart(el?.selectionStart ?? message.length);
    setQuickReplyQuery("");
    setQuickReplyActiveIndex(0);
    el?.focus();
  };

  const handleMessageChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setMessage(value);
    const caret = e.target.selectionStart ?? value.length;
    const match = QUICK_REPLY_TRIGGER_PATTERN.exec(value.slice(0, caret));
    if (match) {
      setQuickReplyTriggerStart(caret - match[0].length);
      setQuickReplyQuery(match[1]);
      setQuickReplyActiveIndex(0);
    } else if (quickReplyOpen && !quickReplyConfiguring) {
      // Only auto-closes the plain matching list on a non-matching edit —
      // once `quickReplyConfiguring` is set the agent's focus has moved
      // into the variable form's own fields, so further edits (there
      // shouldn't be any — the textarea isn't part of that flow anymore)
      // shouldn't tear down the form out from under them.
      closeQuickReplyMenu();
    }
  };

  // Arrow keys/Enter/Escape all handled here, not inside `QuickReplyMenu`
  // itself — see this component's own doc comment for why the textarea
  // must keep owning focus/caret the whole time the menu is open.
  const handleComposerKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (quickReplyOpen && !quickReplyConfiguring) {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setQuickReplyActiveIndex((i) => Math.min(i + 1, Math.max(quickReplyMatches.length - 1, 0)));
          break;
        case "ArrowUp":
          e.preventDefault();
          setQuickReplyActiveIndex((i) => Math.max(i - 1, 0));
          break;
        case "Enter":
          if (quickReplyMatches[quickReplyActiveIndex]) {
            e.preventDefault();
            handleSelectQuickReply(quickReplyMatches[quickReplyActiveIndex]);
          }
          break;
        case "Escape":
          e.preventDefault();
          closeQuickReplyMenu();
          break;
      }
      return;
    }
    // Per explicit request — ordinary typing (the quick-reply picker isn't
    // up): plain Enter sends the message, same as most chat composers
    // (Slack/Intercom/etc.); Shift+Enter still inserts a real newline,
    // since the textarea is multi-line (`rows={3}`) and losing that would
    // make a multi-paragraph reply impossible to type. `handleSend` itself
    // already no-ops on an empty/whitespace-only message (`canSend`), so
    // this is safe to fire unconditionally on a bare Enter.
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
      return;
    }
    // Same request, other half: Tab out of the textarea goes straight to
    // Send, not into the Attach/Bold/Italic/Emoji/Quick replies/Templates
    // toolbar row that sits before it in DOM order (see the render below) —
    // those would otherwise be next in a plain, un-intercepted Tab order.
    // Shift+Tab (backing OUT of the textarea) is left alone, same reasoning
    // `Enter` above leaves Shift+Enter alone.
    if (e.key === "Tab" && !e.shiftKey) {
      e.preventDefault();
      sendButtonRef.current?.focus();
    }
  };

  const handleSend = () => {
    if (!canSend || replyBlockedReason) return;
    onSend(message);
    setMessage("");
  };

  const submitCopilot = (text: string) => {
    const q = (text ?? copilotQuestion).trim();
    if (q) onCopilotAsk?.(q);
    setCopilotQuestion("");
  };
  // A used link chip is swapped for its replacement, if any.
  const activeCopilotSuggestions = (copilotSuggestions ?? [])
    .map((sg) => (copilotUsed.includes(sg) ? copilotSuggestionReplacements?.[sg] : sg))
    .filter((sg): sg is string => !!sg && !copilotUsed.includes(sg));
  const takeover =
    copilotOnly && onTakeover
      ? { label: takeoverLabel, onClick: onTakeover, disabled: takeoverDisabled, disabledReason: takeoverDisabledReason }
      : undefined;
  const copilotComposer = (placement: "inline" | "panel") => (
    <CopilotComposer
      placement={placement}
      value={copilotQuestion}
      onChange={setCopilotQuestion}
      onSubmit={submitCopilot}
      suggestions={activeCopilotSuggestions}
      onActivateSuggestion={activateCopilotSuggestion}
      takeover={takeover}
      focusable={placement === "panel" || composerTab === "copilot"}
      paneRef={placement === "inline" ? copilotPaneRef : undefined}
      className={
        placement === "inline"
          ? `col-start-1 row-start-1 ${composerTab === "copilot" ? "animate-in fade-in-0 duration-200" : "invisible pointer-events-none"}`
          : undefined
      }
      aria-hidden={placement === "inline" ? composerTab !== "copilot" : undefined}
    />
  );

  // Docked (AI in the Contact Details panel): the same composer, portaled
  // into the panel's footer.
  const dockedCopilot = copilotDock?.mount
    ? createPortal(
        copilotComposer("panel"),
        copilotDock.mount,
      )
    : null;
  // Copilot-only and docked: nothing stays inline.
  if (copilotDocked && copilotOnly) return dockedCopilot;

  return (
    <div ref={composerRootRef} className="relative shrink-0 bg-lyra-bg-surface-base px-6 py-4">
      {dockedCopilot}
      <ComposerFade />
      {/* `max-w-[768px]` — kept in sync with the message-column wrapper's
          own matching width above (originally narrowed together from
          1200px to 1024px; later narrowed again, together with that
          wrapper and `VoiceCallControls`' own floating card in
          agent-next-gen-voice-call-controls.tsx, from 1024px to 768px per
          explicit request), so the composer stays the same width as the
          transcript content sitting above it. */}
      <div className="w-full max-w-[768px] mx-auto">
        {quickReplyOpen && (
          // Normal flow, NOT `absolute` — this used to float over the
          // transcript above (a sibling `flex-1 overflow-y-auto` box, not
          // a descendant this composer can resize directly), which
          // visually buried the last few messages behind an opaque panel
          // the agent couldn't scroll past. Sitting in-flow instead grows
          // this composer's own (`shrink-0`) height, which — same flexbox
          // math that already keeps the composer pinned to the bottom at
          // its natural size — shrinks the transcript's available height
          // to make room rather than covering any of it, so its own
          // scrolling keeps working exactly as before, just over a
          // shorter viewport while this is open.
          placeMenu(<div ref={quickReplyContainerRef} className={floatingMenus ? undefined : "mb-2"}>
            {quickReplyConfiguring ? (
              <QuickReplyVariableForm
                title={quickReplyConfiguring.title}
                hashtagId={quickReplyConfiguring.id}
                triggerChar={QUICK_REPLY_TRIGGER_CHAR}
                fields={quickReplyConfiguring.fields ?? []}
                values={quickReplyFieldValues}
                onValueChange={(key, value) => setQuickReplyFieldValues((prev) => ({ ...prev, [key]: value }))}
                preview={fillQuickReplyTemplate(quickReplyConfiguring, quickReplyFieldValues, true)}
                onCancel={closeQuickReplyMenu}
                onClose={closeQuickReplyMenu}
                onInsert={handleInsertRichQuickReply}
              />
            ) : (
              <QuickReplyMenu
                query={quickReplyQuery}
                triggerChar={QUICK_REPLY_TRIGGER_CHAR}
                items={quickReplyMatches.map((item): QuickReplyMenuItem => ({
                  id: item.id,
                  title: item.title,
                  preview: item.template,
                  rich: item.rich,
                }))}
                activeIndex={quickReplyActiveIndex}
                onHoverItem={setQuickReplyActiveIndex}
                onSelect={(menuItem) => {
                  const item = QUICK_REPLIES.find((r) => r.id === menuItem.id);
                  if (item) handleSelectQuickReply(item);
                }}
                onClose={closeQuickReplyMenu}
              />
            )}
          </div>)
        )}
        {/* "Chat with Customer" / "Ask Copilot" tabs: the chat input stays mounted (just hidden) while Copilot is showing so a draft is kept. */}
        {/* Docked Copilot: no mode toggle here, the chat input stands alone. */}
        {copilotDocked ? null : copilotOnly ? (
          // Copilot-only (agent reviewing an AI-led chat): no mode toggle, just the switch at the right.
          onHideAiActionsChange && (
            <div className="mb-3 flex justify-end">
              <Switch size="sm" label="Hide AI Actions" checked={!!hideAiActions} onCheckedChange={onHideAiActionsChange} />
            </div>
          )
        ) : (
        <div className="mb-3 flex items-center justify-between gap-3">
        <ToggleGroup
          ariaLabel="Composer mode"
          allowDeselect={false}
          items={[
            { value: "chat", label: "Chat with Customer" },
            { value: "copilot", label: "Ask Copilot" },
          ]}
          value={composerTab}
          onValueChange={(next: string) => {
            // Always exactly one mode active: ignore the empty value a re-click may emit.
            if (next === "chat" || next === "copilot") setComposerTab(next);
          }}
        />
        {onHideAiActionsChange && (
          <Switch
            size="sm"
            label="Hide AI Actions"
            checked={!!hideAiActions}
            onCheckedChange={onHideAiActionsChange}
          />
        )}
        </div>
        )}
        {/* Both panes share one grid cell so the area keeps the taller (chat) height on either tab.
            `minmax(0,1fr)`: the cell is the column's width, never a pane's min-content. */}
        <div className="grid grid-cols-[minmax(0,1fr)]">
        {!copilotDocked && copilotComposer("inline")}
        <div className={`col-start-1 row-start-1 ${composerTab === "chat" ? "" : "invisible pointer-events-none"}`} aria-hidden={composerTab !== "chat"}>
        {replyBlockedReason && (
          <InlineNotification variant="warning" className="mb-2" data-slot="reply-blocked">
            {replyBlockedReason}
          </InlineNotification>
        )}
        <Textarea
          ref={textareaRef}
          placeholder="Type a message... or / for quick replies"
          rows={3}
          value={message}
          onChange={handleMessageChange}
          onKeyDown={handleComposerKeyDown}
          disabled={!!replyBlockedReason}
        />
        <div className="mt-2 flex items-center justify-between">
          <div className="flex items-center gap-0.5">
            <ActionIconButton size="sm" title="Attach file">
              <Paperclip className="h-4 w-4" strokeWidth={1.5} />
            </ActionIconButton>
            <ActionIconButton size="sm" title="Bold">
              <Bold className="h-4 w-4" strokeWidth={1.5} />
            </ActionIconButton>
            <ActionIconButton size="sm" title="Italic">
              <Italic className="h-4 w-4" strokeWidth={1.5} />
            </ActionIconButton>
            <ActionIconButton size="sm" title="Emoji">
              <Smile className="h-4 w-4" strokeWidth={1.5} />
            </ActionIconButton>
            <ActionIconButton size="sm" title="Quick replies" onClick={openQuickReplyMenuAtCaret} disabled={!!replyBlockedReason}>
              <Zap className="h-4 w-4" strokeWidth={1.5} />
            </ActionIconButton>
            <ActionIconButton size="sm" title="Templates">
              <FileText className="h-4 w-4" strokeWidth={1.5} />
            </ActionIconButton>
          </div>
          <div className="inline-flex items-center">
            <Button
              ref={sendButtonRef}
              variant="default"
              size="lg"
              className="gap-1.5 rounded-r-none"
              disabled={!canSend || !!replyBlockedReason}
              onClick={handleSend}
            >
              <Send className="h-4 w-4" strokeWidth={1.5} />
              Send
            </Button>
            <Button
              variant="default"
              size="icon-lg"
              className="rounded-l-none border-l border-white/25"
              disabled={!canSend || !!replyBlockedReason}
              title="More send options"
            >
              <ChevronDown className="h-4 w-4" strokeWidth={1.5} />
            </Button>
          </div>
        </div>
        </div>
        </div>
      </div>
    </div>
  );
}