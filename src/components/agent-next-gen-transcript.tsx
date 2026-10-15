import { KnowledgeArticleSummaryRow } from "@/components/agent-next-gen-knowledge-article-card";
import React, { useState, useRef, useLayoutEffect, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import {
  AccordionHeadless,
  AccordionHeadlessItem,
  AccordionHeadlessContent,
  Avatar,
  ContactOverview,
  type ContactOverviewInfo,
  CustomerContextOverview,
  type CustomerContextOverviewInfo,
  ChatMessage,
  ActionIconButton,
  TagPicker,
  Tag,
  Button,
  Label,
  Tooltip,
  Popover,
  PanelHeader,
  WarningIconSolid,
  Menu,
  KebabMenuButton,
  Textarea,
  ToggleGroup,
  AIInput,
  Spinner,
  Interstitial,
  Switch,
  Badge,
  QuickReplyVariableForm,
  QuickReplyMenu,
  SuccessIconSolid,
  OutcomePanel,
  type TagVariant,
  type TagPickerOption,
  type DispositionOption,
  type ChannelOutcomeConfig,
  type ChannelType,
  type QuickReplyField,
  type QuickReplyMenuItem,
  type MenuEntry,
  type ChannelDirection,
  VoiceDirectionIcon,
  SmsDirectionIcon,
  formatPhoneForDisplay,
} from "@nicecxone/lyra-ui";
import {
  Copy,
  ArrowLeftRight,
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  UserPlus,
  UserX,
  ArrowDown,
  Paperclip,
  Bold,
  Italic,
  Smile,
  Zap,
  FileText,
  Send,
  FileDown,
  Languages,
  Trash2,
  X,
  PanelRight,
  Bot,
  Sparkles,
  MessageSquareText,
  UserCheck,
  CheckCircle2,
  AlertCircle,
  History,
  RefreshCw,
} from "lucide-react";
import {
  CURRENT_AGENT_FIRST_NAME,
  CURRENT_AGENT_LAST_NAME,
  initialsFor,
  quickReplyFieldDisplayValue,
} from "@/components/agent-next-gen-shared-utils";
import { isAiActionMessage } from "@/components/agent-next-gen-ai-messages";
import { useCapability } from "@/provider-context";

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

export interface TranscriptTag {
  id: string;
  label: string;
  variant: TagVariant;
}

export interface TranscriptMessage {
  id: string;
  sender: "customer" | "agent";
  name: string;
  initials: string;
  timestamp: string;
  text: string;
  tags?: TranscriptTag[];
  /** Renders as a plain system-event line ("time · name" over bold text, no bubble/avatar) instead of a chat bubble. */
  event?: boolean;
  /** Renders as a collapsible AI "Approval request" summary card (purple header band, checklist, experience memory, sentiment). */
  summary?: TranscriptApprovalSummary;
  /** The decision already made on this approval card (the provider's record), so a remounted card shows it decided. */
  decided?: { value: string; note?: string };
  /** Renders the "AI agent finished performing this." line plus a clickable instruction row (opens a side panel via `onSnapshotLink`). */
  instruction?: { title: string; by: string; link: string };
  /** Renders a "Wrap up" accordion (same shell as the approval request, success-subtle header) with a summary and a completion button. */
  wrapUp?: { title: string; summary: string; disposition: string; buttonLabel: string; exiting?: boolean };
}

export interface TranscriptApprovalSummary {
  title: string;
  headline: string;
  description: string;
  checklist: { label: string; detail: string; status: "done" | "attention"; badge?: string; link?: string }[];
  memoryTitle: string;
  memory: string[];
  sentimentLabel: string;
  sentimentValue: string;
  /** 1–5 filled segments */
  sentimentLevel: number;
  /** Hides the checklist / Experience Memory / sentiment block (content kept) so the card shows only the headline and description. */
  hideDetails?: boolean;
  /** Decision options (Marcus-style task card): pill options → optional note → Perform Task → working → typing → result. */
  decisions?: {
    value: string;
    title: string;
    description?: string;
    notePlaceholder?: string;
    noteLabel?: string;
    /** Selecting this option asks the page to open an outbound-call popover (anchored on the option); the card only shows its result once the page confirms the call was launched. */
    callRequest?: boolean;
    /** Quick-prompt chips above the note box; clicking one fills it in. */
    suggestions?: string[];
    /** Suggestions that open a side panel (after a brief interstitial) instead of filling the note: label → link key. */
    suggestionLinks?: Record<string, string>;
    /** After a link suggestion is used it is removed and replaced by this one: label → replacement label. */
    suggestionReplacements?: Record<string, string>;
    /** Selecting this option reveals a content area (instead of submitting immediately) with a confirm button. */
    panel?: {
      headline: string;
      description: string;
      memory: string;
      card: { title: string; sub: string };
      article?: { label: string; link: string };
      confirmLabel: string;
    };
    /** After submitting, the options stay open (note cleared) so the agent can send another instruction. */
    repeatable?: boolean;
    result: string;
  }[];
}

type ApprovalDecisionDef = NonNullable<TranscriptApprovalSummary["decisions"]>[number];

/**
 * Settings → AI display "In the Contact Details panel" (P-SETTINGS, ported
 * from v3): the AI content that normally sits inline in the transcript
 * (instruction interstitials, approval request summaries, wrap-up cards,
 * event lines) rendered as a stacked feed for the Contact Details panel
 * instead. `overview` is the (already built) Autosummary block shown first.
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
  return (
    <div className="flex flex-col gap-3">
      {overview}
      {aiMessages.map((message) =>
        message.instruction ? (
          <InstructionInterstitial
            key={message.id}
            id={message.id}
            instruction={message.instruction}
            timestamp={message.timestamp}
            onOpen={(link) => onSnapshotLink?.(link)}
            active={activeSnapshotLink === message.instruction.link}
          />
        ) : message.wrapUp ? (
          <WrapUpAccordion key={message.id} message={message} onComplete={onWrapUpComplete} />
        ) : message.summary ? (
          <ApprovalSummaryAccordion
            key={message.id}
            message={message}
            onDecide={onApprovalDecision}
            onCallRequest={onApprovalCallRequest}
            onLink={onSnapshotLink}
            onSuggestionAsk={onApprovalSuggestionAsk}
            takenOver={approvalTakenOver}
          />
        ) : (
          <div key={message.id} className="flex flex-col gap-0.5">
            <span className="lyra-body-sm text-lyra-fg-secondary">
              {message.timestamp} · {message.name}
            </span>
            <span className="lyra-body-md-emphasis text-lyra-fg-default">{message.text}</span>
          </div>
        )
      )}
    </div>
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
    <div className="overflow-hidden rounded-lyra-md border border-lyra-border-subtle">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="group flex w-full cursor-pointer items-center gap-2 bg-lyra-status-success-subtle px-4 py-2.5 text-left transition-colors hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-lyra-border-focus"
      >
        <Sparkles className="h-4 w-4 shrink-0 text-lyra-status-success-strong" strokeWidth={1.5} aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate lyra-body-md-emphasis text-lyra-fg-default">
          {wrapUp.title} <span className="lyra-body-md font-normal text-lyra-fg-secondary">{message.timestamp}</span>
        </span>
        <span className="shrink-0 lyra-body-sm text-lyra-fg-secondary">Copilot summary</span>
        <ChevronDown
          className={cn("h-5 w-5 shrink-0 text-lyra-fg-secondary transition-transform", open && "rotate-180")}
          strokeWidth={1.5}
          aria-hidden="true"
        />
      </button>
      <div
        className={cn(
          "grid transition-[grid-template-rows,opacity] duration-200 ease-out",
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        )}
        aria-hidden={!open}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="flex flex-col gap-3 bg-lyra-bg-surface-container-subtle px-4 py-4">
            <p className="lyra-body-md text-lyra-fg-default">{wrapUp.summary}</p>
            <p className="lyra-body-sm text-lyra-fg-secondary">{wrapUp.disposition}</p>
            <div>
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
        </div>
      </div>
    </div>
    </div>
    </div>
  );
}

/** Marcus-style decision flow: pick an option → (optional note) → Perform Task. What happens next (working, events, the AI replying to the customer) plays out in the chat via `onDecide`, not inside this card. */
function ApprovalDecision({
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
    <div className="flex flex-col gap-3 border-t border-lyra-border-subtle pt-3">
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
            {decisions.map((d) => {
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
  return (
    <div className="overflow-hidden rounded-lyra-md border border-lyra-border-subtle">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="group flex w-full cursor-pointer items-center gap-2 bg-lyra-status-info-subtle px-4 py-2.5 text-left transition-colors hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-lyra-border-focus"
      >
        <Sparkles className="h-4 w-4 shrink-0 text-lyra-status-info-strong" strokeWidth={1.5} aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate lyra-body-md-emphasis text-lyra-fg-default">
          {summary.title} <span className="lyra-body-md font-normal text-lyra-fg-secondary">{message.timestamp}</span>
        </span>
        <span className="shrink-0 lyra-body-sm text-lyra-fg-secondary">Copilot summary</span>
        <ChevronDown
          className={cn("h-5 w-5 shrink-0 text-lyra-fg-secondary transition-transform", open && "rotate-180")}
          strokeWidth={1.5}
          aria-hidden="true"
        />
      </button>
      <div
        className={cn(
          "grid transition-[grid-template-rows,opacity] duration-200 ease-out",
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        )}
        aria-hidden={!open}
      >
        <div className="min-h-0 overflow-hidden">
        <div className="flex flex-col gap-3 bg-lyra-bg-surface-container-subtle px-4 py-4">
          <p className="lyra-body-lg-emphasis text-lyra-fg-default">{summary.headline}</p>
          <p className="lyra-body-md text-lyra-fg-default">{summary.description}</p>
          {hasDetails && (
            <button
              type="button"
              onClick={() => setShowMore((v) => !v)}
              aria-expanded={showMore}
              className="self-start lyra-body-md text-lyra-fg-link hover:underline focus-visible:outline-none focus-visible:underline"
            >
              {showMore ? "Show less" : "Show more"}
            </button>
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
                        <button
                          type="button"
                          onClick={() => onLink(item.link!)}
                          className="text-left text-lyra-fg-link hover:underline focus-visible:outline-none focus-visible:underline"
                        >
                          {item.label}
                        </button>
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
        </div>
      </div>
      {/* The decision footer sits outside the collapsing region, so it stays visible (options pending) when the summary is collapsed. */}
      {footer && <div className={cn("bg-lyra-bg-surface-container-subtle px-4 pb-4", !open && "pt-3")}>{footer}</div>}
      {!footer && summary.decisions && summary.decisions.length > 0 && (
        <div className={cn("bg-lyra-bg-surface-container-subtle px-4 pb-4", !open && "pt-3")}>
          <ApprovalDecision decisions={summary.decisions} onDecide={onDecide} onLink={onLink} onSuggestionAsk={onSuggestionAsk} onCallRequest={onCallRequest} takenOver={takenOver} decided={message.decided} />
        </div>
      )}
    </div>
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

/* Each `Contact` is one contact record within the interaction —
   the reference screenshot's "# CTX-20250722-08841 · July 22, 2025 ⌄"
   separator plus the "Session Details" panel it expands to (Contact ID /
   Date / Start / End / Channel / Skill / Agent / Status). A single
   interaction can span more than one session (a callback, a follow-up
   message thread days later, etc.) — grouping `TranscriptMessage[]` under
   a session rather than one flat list is what lets the transcript render a
   separator between each and let every one collapse/expand independently.
   Two mock sessions here (a closed first contact, then a shorter follow-up)
   are enough to demonstrate the separator-per-session + sticky-stacking
   behavior; still a UI prototype, not real per-interaction session data.
   Session info (this separator + its Session Details panel) is shown for
   every channel type — Voice/Email get their own sibling arrays just below
   (`TRANSCRIPT_SESSIONS_VOICE`/`TRANSCRIPT_SESSIONS_EMAIL`), each with an
   empty `messages: []` since neither channel has designed transcript
   content yet (a call recording/summary UI, an email thread UI) — the
   session separator and its expandable details still apply to a call or an
   email the same as they do to a chat, it's only the message-by-message
   body underneath that's still a placeholder. See `InteractionTranscript`'s
   per-session render below for where that placeholder actually shows. */
// Status → `Tag` variant for `TranscriptSessionSeparator`'s pill — a small,
// local map rather than reusing `CUSTOMER_LATEST_INTERACTION_STATUS_POOL`
// (Customer Information panel's own status pool): that one's a random-draw
// pool for a different feature's synthesized data and doesn't even include
// "Open" (every draw there is Resolved/Escalated/Pending), so it isn't
// actually the same vocabulary. `Tag` (pill shape), not `Badge` — per
// explicit request, matching the same pill-shaped tag treatment used
// elsewhere in this transcript (e.g. the applied message tags just above
// the composer). Falls back to "neutral" for any future
// `Contact.status` value not listed here, rather than throwing.
// Now covers every status the session-status popover offers (see
// `TRANSCRIPT_SESSION_STATUS_OPTIONS` just below) — "warning"/"info"/
// "purple"/"success"/"critical" read as orange/blue/purple/green/red, the
// same five hues that popover's own dot swatches use.
export const TRANSCRIPT_SESSION_STATUS_VARIANT: Record<string, TagVariant> = {
  Open: "warning",
  Pending: "info",
  Escalated: "purple",
  Resolved: "success",
  Closed: "critical",
};

// The session-status popover's own row list (reference screenshot: a dot +
// label per row, one highlighted as the current selection) — dot colors
// mirror the exact same semantic mapping as `TRANSCRIPT_SESSION_STATUS_
// VARIANT` above (so the chip and the popover's own "current" row always
// agree), just resolved straight to the underlying CSS var instead of
// through `Badge`'s circle-shape `variant` prop: that only exposes 6
// semantic roles and has no true purple, so a plain inline-styled dot (same
// small circle shape `Badge`'s own `dot` mode renders, just not routed
// through the component) is what actually reaches "Escalated"'s purple in
// the reference screenshot. Order matches the reference screenshot's own
// row order (Open/Pending/Escalated/Resolved/Closed), not alphabetical.
export const TRANSCRIPT_SESSION_STATUS_OPTIONS: { label: string; dotColor: string }[] = [
  { label: "Open", dotColor: "var(--lyra-color-status-warning-strong)" },
  { label: "Pending", dotColor: "var(--lyra-color-status-info-strong)" },
  { label: "Escalated", dotColor: "var(--lyra-color-accent-purple-strong)" },
  { label: "Resolved", dotColor: "var(--lyra-color-status-success-strong)" },
  { label: "Closed", dotColor: "var(--lyra-color-status-critical-strong)" },
];

/* ── Outcome popover mock data ──
 * Option lists for the "Outcome" popover (`ChannelRow`'s own `outcome` prop,
 * channel-row.tsx) — Disposition-code choices and the tag palette are
 * business data, which is exactly why `ChannelRow` itself takes these as
 * props instead of hardcoding them (see `ChannelOutcomeConfig`'s own doc
 * comment). Kept as flat module-level consts, same as
 * `TRANSCRIPT_SESSION_STATUS_OPTIONS` just above — none of these depend on
 * component state/props.
 *
 * There's no separate `OUTCOME_RESOLUTION_OPTIONS` here anymore — the
 * Outcome popover's "Resolution" field now reuses
 * `TRANSCRIPT_SESSION_STATUS_OPTIONS` directly (wired below, in `channels`)
 * so it shows the exact same Open/Pending/Escalated/Resolved/Closed
 * colored-dot rows as the session-status pill's own dropdown, and both
 * read/write the same `interaction.channelStatuses` entry for that specific
 * channel — changing status in either place changes it in both, per
 * explicit request. */
export const OUTCOME_TAG_OPTIONS: TagPickerOption[] = [
  { label: "Technical", variant: "info" },
  { label: "Account", variant: "purple" },
  { label: "Billing", variant: "warning" },
  { label: "General Support", variant: "teal" },
  { label: "VIP", variant: "critical" },
];

// Widened from 5 flat entries to 25, grouped into named sections
// (`category`) — real contact-center ACD/QM disposition-code vocabulary,
// per explicit request (own follow-up to the 15 agent-status "reason
// codes" stress test above: same idea, applied to the Outcome popover's
// Disposition field instead). `DispositionSelect` (disposition-select.tsx)
// is what actually renders these as collapsible sections with a
// per-row favorite star, replacing the flat searchable `Select` this field
// used before — see that component's own doc comment for why `Select`
// itself can't do sections. Category order here is section order there
// (first-seen, not alphabetical).
export const OUTCOME_DISPOSITION_OPTIONS: DispositionOption[] = [
  // Resolution
  { value: "Issue Resolved", label: "Issue Resolved", category: "Resolution" },
  { value: "First Contact Resolution", label: "First Contact Resolution", category: "Resolution" },
  { value: "Resolved - Self-Service", label: "Resolved - Self-Service", category: "Resolution" },
  { value: "Resolved - Knowledge Base Article", label: "Resolved - Knowledge Base Article", category: "Resolution" },
  // Escalation
  { value: "Escalated to Tier 2", label: "Escalated to Tier 2", category: "Escalation" },
  { value: "Escalated to Supervisor", label: "Escalated to Supervisor", category: "Escalation" },
  { value: "Escalated to Specialist Team", label: "Escalated to Specialist Team", category: "Escalation" },
  { value: "Flagged for Review", label: "Flagged for Review", category: "Escalation" },
  // Follow-Up
  { value: "Follow-Up Required", label: "Follow-Up Required", category: "Follow-Up" },
  { value: "Customer Callback Scheduled", label: "Customer Callback Scheduled", category: "Follow-Up" },
  { value: "Pending Customer Response", label: "Pending Customer Response", category: "Follow-Up" },
  { value: "Awaiting Parts / Inventory", label: "Awaiting Parts / Inventory", category: "Follow-Up" },
  // Transfer
  { value: "Transferred - Billing", label: "Transferred - Billing", category: "Transfer" },
  { value: "Transferred - Technical Support", label: "Transferred - Technical Support", category: "Transfer" },
  { value: "Transferred - Sales", label: "Transferred - Sales", category: "Transfer" },
  { value: "Transferred - Other Department", label: "Transferred - Other Department", category: "Transfer" },
  // No Resolution
  { value: "No Resolution", label: "No Resolution", category: "No Resolution" },
  { value: "Unable to Resolve", label: "Unable to Resolve", category: "No Resolution" },
  { value: "Duplicate Contact", label: "Duplicate Contact", category: "No Resolution" },
  { value: "Customer Disconnected", label: "Customer Disconnected", category: "No Resolution" },
  { value: "Abandoned Call", label: "Abandoned Call", category: "No Resolution" },
  // Account & Billing
  { value: "Billing Dispute Resolved", label: "Billing Dispute Resolved", category: "Account & Billing" },
  { value: "Refund Processed", label: "Refund Processed", category: "Account & Billing" },
  { value: "Exception Approved", label: "Exception Approved", category: "Account & Billing" },
  { value: "Account Information Updated", label: "Account Information Updated", category: "Account & Billing" },
  // Other
  { value: "Information Provided", label: "Information Provided", category: "Other" },
  { value: "Complaint Logged", label: "Complaint Logged", category: "Other" },
];

export const OUTCOME_DEFAULT_SUMMARY =
  "Interaction with davidbauerjr@gmail.com — customer concern reviewed and resolved. Agent provided clear guidance and confirmed next steps. Follow-up actions logged where applicable.";

/** Client/device metadata captured off a session's own originating client
 *  (OS/Browser/Language/Device Type/Application Type) — shown as a single
 *  "chat fingerprint" line in that session's `TranscriptSessionDetails`
 *  footer (per explicit request/reference screenshot). Optional on
 *  `Contact`; every channel now populates one (see the three
 *  `TRANSCRIPT_SESSION_FINGERPRINT*` consts right below — chat/SMS/WhatsApp
 *  share one shape, Voice and Email each get their own since "Browser"/
 *  "Application Type" mean something different for a WebRTC call or a
 *  webmail client than for a chat widget), so the footer now renders for
 *  every channel type rather than only text channels — per an explicit
 *  follow-up request after the original "text channels only" scoping. */
export interface TranscriptSessionFingerprint {
  os: string;
  browser: string;
  language: string;
  deviceType: string;
  applicationType: string;
}

// One shared, reused mock fingerprint per channel family (per the reference
// screenshot) rather than inventing slightly different device info per
// session — same "one plausible example, reused" pattern
// `OUTCOME_DEFAULT_SUMMARY` above already uses; there's no real per-session
// client telemetry anywhere in this app's data for it to vary by.
export const TRANSCRIPT_SESSION_FINGERPRINT: TranscriptSessionFingerprint = {
  os: "Windows 10",
  browser: "Edge v.150.0.0.0",
  language: "en-US",
  deviceType: "Desktop",
  applicationType: "Browser",
};

// Voice's own fingerprint — this app's Voice channel is a browser-based
// WebRTC call (not a plain PSTN handset), so a real OS/browser fingerprint
// still applies; "Application Type" reads "WebRTC Call" instead of "Browser"
// to reflect that it's the softphone leg of the browser session, not a
// regular page.
export const TRANSCRIPT_SESSION_FINGERPRINT_VOICE: TranscriptSessionFingerprint = {
  os: "macOS Sonoma",
  browser: "Chrome v.128.0.0.0",
  language: "en-US",
  deviceType: "Desktop",
  applicationType: "WebRTC Call",
};

// Email's own fingerprint — captured off the webmail client the customer
// replied from, hence "Application Type" reading "Webmail" rather than
// "Browser" (the browser row still names the specific webmail client).
export const TRANSCRIPT_SESSION_FINGERPRINT_EMAIL: TranscriptSessionFingerprint = {
  os: "Windows 11",
  browser: "Outlook Web Access",
  language: "en-US",
  deviceType: "Desktop",
  applicationType: "Webmail",
};

export interface Contact {
  id: string;
  contactId: string;
  /** Per explicit request ("display the number in the session row instead
   *  of the contact ID — display email/whatsapp handle/etc. for phase
   *  2"): the human-readable reach address for this session (phone number/
   *  email address/WhatsApp handle — same generic meaning as `Thread.
   *  addressLabel`, which is exactly where this comes from for the live
   *  session; see `InteractionTranscript`'s own `channelAddressLabel` prop
   *  doc comment). Undefined for every static historical mock `Contact`
   *  (TRANSCRIPT_SESSIONS/_VOICE/_EMAIL — none have a real stored address)
   *  and for any live channel with no known address of its own (a redialed
   *  voice call, an ad-hoc/typed contact) — `TranscriptSessionSeparator`
   *  falls back to the plain "# contactId" display in that case, exactly
   *  as before this field existed. */
  addressLabel?: string;
  date: string;
  startTime: string;
  endTime: string;
  channel: string;
  skill: string;
  agent: string;
  status: string;
  /** See `TranscriptSessionFingerprint`'s own doc comment above. */
  fingerprint?: TranscriptSessionFingerprint;
  messages: TranscriptMessage[];
}

export const TRANSCRIPT_SESSIONS: Contact[] = [
  {
    id: "session-1",
    contactId: "CTX-20250722-08841",
    date: "July 22, 2025",
    startTime: "9:13 AM",
    endTime: "9:27 AM",
    channel: "SMS",
    skill: "SMS Support",
    agent: "John Smith",
    status: "Resolved",
    fingerprint: TRANSCRIPT_SESSION_FINGERPRINT,
    messages: [
      {
        id: "m1",
        sender: "customer",
        name: "Liam Davis",
        initials: "LD",
        timestamp: "9:14 AM",
        text: "Hi, I'm having trouble with my recent invoice — it looks like I was charged twice for the same service.",
      },
      {
        id: "m2",
        sender: "agent",
        name: "John Smith",
        initials: "JS",
        timestamp: "9:15 AM",
        text: "Hi! Thanks for reaching out. I'm sorry to hear that — let me pull up your account right away.",
      },
      {
        id: "m3",
        sender: "agent",
        name: "John Smith",
        initials: "JS",
        timestamp: "9:17 AM",
        text: "I can see the duplicate charge from July 18th. I'll submit a refund request for the second charge now.",
      },
      {
        id: "m4",
        sender: "customer",
        name: "Liam Davis",
        initials: "LD",
        timestamp: "9:18 AM",
        text: "Thank you! How long will it take?",
        tags: [{ id: "m4-billing", label: "Billing", variant: "default" }],
      },
      {
        id: "m5",
        sender: "agent",
        name: "John Smith",
        initials: "JS",
        timestamp: "9:20 AM",
        text: "Refunds typically appear within 3–5 business days. You'll also receive a confirmation email shortly.",
      },
      {
        id: "m6",
        sender: "customer",
        name: "Liam Davis",
        initials: "LD",
        timestamp: "9:22 AM",
        text: "Great, sounds good. One more thing — can I also update the billing email on file?",
      },
      {
        id: "m7",
        sender: "agent",
        name: "John Smith",
        initials: "JS",
        timestamp: "9:23 AM",
        text: "Of course! What would you like to change it to?",
      },
      {
        id: "m8",
        sender: "customer",
        name: "Liam Davis",
        initials: "LD",
        timestamp: "9:24 AM",
        text: "Please update it to: sarah.chen@example.com",
      },
      {
        id: "m9",
        sender: "agent",
        name: "John Smith",
        initials: "JS",
        timestamp: "9:25 AM",
        text: "Done! Your billing email has been updated. Is there anything else I can help with?",
      },
      {
        id: "m10",
        sender: "customer",
        name: "Liam Davis",
        initials: "LD",
        timestamp: "9:26 AM",
        text: "No, that's all. Thanks for your help!",
      },
    ],
  },
  {
    id: "session-2",
    contactId: "CTX-20250723-09234",
    date: "July 23, 2025",
    startTime: "2:04 PM",
    endTime: "2:12 PM",
    channel: "SMS",
    skill: "SMS Support",
    agent: "John Smith",
    // The follow-up session (the customer came back because the refund
    // still hadn't appeared) is genuinely still open, unlike the first
    // session it follows up on — per explicit request, so the two session
    // pills read differently rather than both saying "Resolved".
    status: "Open",
    fingerprint: TRANSCRIPT_SESSION_FINGERPRINT,
    messages: [
      {
        id: "m11",
        sender: "customer",
        name: "Liam Davis",
        initials: "LD",
        timestamp: "2:05 PM",
        text: "Hi again — the refund still hasn't appeared on my account.",
      },
      {
        id: "m12",
        sender: "agent",
        name: "John Smith",
        initials: "JS",
        timestamp: "2:08 PM",
        text: "Hi! I apologize for the delay. I can see the refund was processed on our end — it may take until the end of the business day to appear.",
      },
      {
        id: "m13",
        sender: "customer",
        name: "Liam Davis",
        initials: "LD",
        timestamp: "2:10 PM",
        text: "Okay, I'll check again tomorrow.",
      },
      {
        id: "m14",
        sender: "agent",
        name: "John Smith",
        initials: "JS",
        timestamp: "2:11 PM",
        text: "Sounds good! Feel free to reach back out if you don't see it by tomorrow afternoon.",
      },
    ],
  },
];

// Voice's own session — see `Contact`'s own doc comment above for
// why `messages` is empty here. One closed/"Resolved" session is enough to
// show the separator + Session Details for a call, same as chat's own mock
// log demonstrates it for SMS/WhatsApp.
export const TRANSCRIPT_SESSIONS_VOICE: Contact[] = [
  {
    id: "session-voice-1",
    contactId: "CTX-20250718-04417",
    date: "July 18, 2025",
    startTime: "11:02 AM",
    endTime: "11:19 AM",
    channel: "Voice",
    skill: "Voice Support",
    agent: "John Smith",
    status: "Resolved",
    fingerprint: TRANSCRIPT_SESSION_FINGERPRINT_VOICE,
    messages: [],
  },
];

// Email's own session — same reasoning as `TRANSCRIPT_SESSIONS_VOICE` just
// above.
export const TRANSCRIPT_SESSIONS_EMAIL: Contact[] = [
  {
    id: "session-email-1",
    contactId: "CTX-20250719-05532",
    date: "July 19, 2025",
    startTime: "3:41 PM",
    endTime: "3:58 PM",
    channel: "Email",
    skill: "Email Support",
    agent: "John Smith",
    status: "Resolved",
    fingerprint: TRANSCRIPT_SESSION_FINGERPRINT_EMAIL,
    messages: [],
  },
];

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
          {!narrow && <Avatar icon={Bot} size="xs" className="bg-[#6149C1] text-white" />}
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

/* ── TranscriptSessionDetails ──
   The "Session Details" card a session separator expands to (reference
   screenshot 2) — Contact ID/Date, Start/End, Channel/Skill, Agent/Status,
   two fields per row. Uses lyra-ui's own documented "Label Horizontal"
   pattern (`Input.stories.tsx`'s `LabelHorizontalWithSeparator` story: the
   real `Label` atom on the left, a plain `lyra-body-md text-lyra-fg-
   secondary` value span on the right, in one row) rather than `Input` —
   `Input` always stacks its label *above* the field, which read as a
   normal editable-looking form regardless of `readonly`, not the
   horizontal label/value row the reference screenshot shows. Same pattern
   minus that story's trailing `Separator` — explicitly no dividers between
   rows here, this card is one glanceable block, not a divided list. Two
   pairs per row via `.lyra-form-grid` (an existing lyra-tokens.css
   container-query family, not a bare Tailwind `grid-cols-2`) under a
   `lyra-form-grid-wrap` boundary, same mechanism `CustomerDetailTabContent`
   uses for its own 2-up field rows.

   Wrapped in the same neutral `rounded-lyra-md border border-lyra-border-
   subtle bg-lyra-bg-control-subtle` container CONTRIBUTING.md's "Composing
   panel body content" convention uses for a card-like block sitting inside
   a body area — the Overview tab's own "Latest Interaction" accordion uses
   the identical classes for the same reason (a block that reads as a
   distinct card, not flush against the transcript's own background). */
export function TranscriptSessionDetails({
  session,
  plain = false,
}: {
  session: Contact;
  /** Drops the card chrome (border/background/max-height scroll) and the
   *  internal "Session Details" heading below — for use as the BODY of an
   *  `InteriorPanel` that already supplies its own "Session Details" header
   *  and its own scroll container, rather than as an inline card embedded
   *  in the transcript (the original use this component still defaults to,
   *  `plain=false`, for anywhere else that might reuse it). Only the outer
   *  wrapper/heading are conditional — the field grid and fingerprint
   *  footer render identically either way. */
  plain?: boolean;
}) {
  const rows: Array<[string, string, string, string]> = [
    ["Contact ID", session.contactId, "Date", session.date],
    ["Start", session.startTime, "End", session.endTime],
    ["Channel", session.channel, "Skill", session.skill],
    ["Agent", session.agent, "Status", session.status],
  ];
  // "Chat fingerprint" footer (per explicit request/reference screenshot) —
  // `session.fingerprint` is populated for every channel now (see
  // `TranscriptSessionFingerprint`'s own doc comment), so this only reads
  // `undefined`/omits the footer for a session with no fingerprint data at
  // all (there currently isn't one, but the guard stays defensive).
  const fingerprintFields: Array<[string, string]> | undefined = session.fingerprint
    ? [
        ["OS", session.fingerprint.os],
        ["Browser", session.fingerprint.browser],
        ["Language", session.fingerprint.language],
        ["Device Type", session.fingerprint.deviceType],
        ["Application Type", session.fingerprint.applicationType],
      ]
    : undefined;
  return (
    // Per explicit request, capped to 225px with its own internal scroll
    // once content overflows that. Scroll/height live on THIS outer div,
    // deliberately kept separate from the inner `lyra-form-grid-wrap` div
    // below (rather than merged onto one element) — `lyra-form-grid-wrap`
    // sets `container-type: inline-size` (lyra-tokens.css) to drive the
    // `.lyra-form-grid` two-column container-query breakpoints, and
    // combining that containment context with `overflow-y-auto`/
    // `max-height` on the SAME element was clipping the fingerprint
    // footer (the row after `.map`) even while scrolled — a container-type
    // element establishes its own containment/formatting context, which
    // doesn't play well stacked with scroll-clipping on that exact box.
    // Two plain, single-purpose boxes avoids the interaction entirely.
    <div
      className={cn(
        !plain && "max-h-[225px] overflow-y-auto rounded-lyra-md border border-lyra-border-subtle bg-lyra-bg-control-subtle"
      )}
    >
      <div className={cn("flex flex-col gap-3 lyra-form-grid-wrap", !plain && "p-4")}>
        {!plain && <h3 className="lyra-body-md-emphasis text-lyra-fg-default">Session Details</h3>}
        {rows.map(([label1, value1, label2, value2]) => (
          <div key={label1} className="lyra-form-grid">
            <div className="flex items-center justify-between gap-4">
              <Label label={label1} />
              <span className="lyra-body-md text-lyra-fg-secondary">
                {value1}
              </span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <Label label={label2} />
              <span className="lyra-body-md text-lyra-fg-secondary">{value2}</span>
            </div>
          </div>
        ))}
        {fingerprintFields && (
          // Per explicit request: one single inline text flow, not the
          // two-per-row grid the fields above use — but wraps onto
          // additional lines rather than truncating to an ellipsis when it
          // doesn't fit on one line (an earlier version used `truncate`
          // here; per explicit follow-up request that hid fields when the
          // card narrowed, so this now just lets it wrap like normal text).
          // `border-t` sets this apart as the card's own footer, same
          // divider treatment `Popover`'s own footer slot elsewhere in this
          // file already uses between body content and a trailing row.
          <p className="border-t border-lyra-border-subtle pt-3 lyra-body-sm text-lyra-fg-secondary">
            {fingerprintFields.map(([label, value], i) => (
              <React.Fragment key={label}>
                {i > 0 && <span aria-hidden="true"> | </span>}
                <span className="lyra-body-sm-emphasis text-lyra-fg-default">{label}</span> {value}
              </React.Fragment>
            ))}
          </p>
        )}
      </div>
    </div>
  );
}

/* ── TranscriptSessionSeparator ──
   The "# CTX-... · <date>" pill row between sessions. `sticky top-0` (no
   extra plumbing needed — this relies on plain CSS sticky-header stacking:
   each separator is the first child of its own session block, in normal
   document flow as a sibling of the next session block below it, so as the
   transcript's own `overflow-y-auto` container scrolls, a separator sticks
   to the top for as long as its session's messages are still scrolling by,
   then gets pushed off-screen the instant the *next* session block's own
   top — and therefore its own separator — reaches the scroll container's
   top edge. That hand-off is the "then it replaces the other one" behavior
   from the request; no scroll listener or IntersectionObserver needed for
   it, just each separator being `sticky top-0` in source order.
   `bg-lyra-bg-surface-base` keeps messages scrolling underneath from
   showing through while it's pinned; `z-[1]` keeps it above them —
   deliberately *not* `z-10`: `CustomerInformationSidePanel` (the
   docked panel this transcript sits beside) renders at `z-[5]`
   (side-panel.tsx), and a sticky element's own `z-index` opens a new
   stacking context compared against siblings up the tree, not just against
   the messages scrolling directly beneath it — `z-10` was outranking that
   panel and painting the separator/expanded Session Details card over top
   of it once the panel had content past the fold (confirmed via
   screenshot). `z-[1]` is enough to clear plain in-flow message content
   (which has no z-index of its own) while staying under every panel in
   this file that intentionally layers above the transcript.

   The trailing gradient div is the same "soft fade instead of a hard edge"
   technique `InteractionComposer` uses for its own top edge (see that
   component's doc comment), mirrored: `position: sticky` already
   establishes a containing block for an absolutely-positioned descendant
   (same as `relative` would), so no extra wrapper is needed here. Placed
   at `-bottom-8` (outside this div's own box, extending down into the
   messages scrolling underneath) rather than as internal bottom padding,
   so it overlays whatever message content is passing directly beneath the
   separator instead of just adding empty space inside it. Gradient runs
   solid (matching this bar's own background) at the top down to
   transparent at the bottom — the reverse of the composer's direction,
   since here the solid edge is at the *top* of the fade band, not the
   bottom.

   "View Details" used to expand `TranscriptSessionDetails` inline right
   below this pill, animated via lyra-ui's headless accordion building
   blocks (AccordionHeadless/-Item/-Content) — plain `div`s now (see
   `onViewDetails`'s own doc comment below): per explicit request, it opens
   an external `InteriorPanel` instead (`InteractionTranscript`'s own
   `onViewSessionDetails` prop), so there's no open/closed state left here
   to animate. `openSessionIds`/`toggleSession` (the state that used to
   drive the accordion's `value`) are gone from `InteractionTranscript` for
   the same reason.

   The status `Tag` (e.g. "Resolved") used to be plain decoration inside
   the same big toggle button as the rest of the pill. It's now its own
   `Popover` trigger, pulled out of that button into a sibling — clicking
   it opens a status list (`Menu`, `bare` since `Popover`'s own content
   wrapper already supplies the surface) instead of toggling Session
   Details, so the two actions (change status / expand details) don't
   fight over one click target. Picking "Closed" swaps that same popover's
   `content` to a confirm view instead of closing it (`statusMenuView`) —
   one Popover instance, two possible bodies, not a second nested Popover —
   matching the reference screenshots' "select Closed → a warning to
   confirm" flow. Once a session's status IS "Closed", the trigger is
   `disabled` (`isClosed` below): there's no way back in from here, matching
   "closed cannot be re-opened." All the actual status state (which session
   is "Closed" now, which popover/view is open) lives in
   `InteractionTranscript` (this component owns no state of its own) —
   same reasoning `sessionMessages` already lives one level up: every
   session's status is independent, and only one status popover should
   ever be open across the whole transcript at a time. */

/** Per explicit request ("update the consult/transfer icon to be 2 arrows
 *  like in screenshot 2") — was a Person + redirect-arrow composite,
 *  mirroring lyra-ui's own `ConsultTransferIcon` (channel-row.tsx), which
 *  got the identical swap; both now render Lucide's own `ArrowLeftRight`
 *  (two opposing horizontal arrows) directly, so this is a plain icon
 *  rather than a composed one, still recreated locally here since lyra-ui's
 *  copy stays a private, unexported helper in that file. */
export function TransferIcon() {
  return <ArrowLeftRight className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />;
}

/** Status pill + its Popover/Menu/"Close Contact?" confirm-view dropdown —
 *  extracted out of `TranscriptSessionSeparator`'s own status tag (below,
 *  which still uses this for its per-session row) so `AgentNextGenPage.tsx`'s
 *  record header can render the exact same control (Agent Workspace 2.0
 *  only — see that file's own `showChannelTabRow`/`showSessionActionCluster`
 *  doc comments) once the session row's own copy is hidden there, per
 *  explicit request, rather than hand-duplicating this ~100-line Popover a
 *  second time. Fully controlled, no state of its own — `menuOpen`/
 *  `menuView` (and their change handlers) are owned by whichever caller
 *  needs them: `InteractionTranscript`'s own per-session `statusMenuOpenId`/
 *  `statusMenuView` state for the session-row usage (only one status
 *  popover open across every session in a transcript at a time), a lone
 *  local `useState` pair for the header's single-instance usage. */
export function ChannelStatusTag({
  status,
  menuOpen,
  menuView,
  onMenuOpenChange,
  onSelectStatus,
  onConfirmClose,
  onCancelClose,
  disabled,
  className,
}: {
  status: string;
  menuOpen: boolean;
  menuView: "menu" | "confirm";
  onMenuOpenChange: (open: boolean) => void;
  /** A non-"Closed" status picked straight from the list — applies
   *  immediately and closes the popover. Picking "Closed" itself doesn't
   *  call this; see `onConfirmClose` below. */
  onSelectStatus: (status: string) => void;
  /** "Close" clicked on the confirm view — actually applies the "Closed"
   *  status and closes the popover. */
  onConfirmClose: () => void;
  /** "Cancel" clicked on the confirm view — closes the popover without
   *  changing anything. */
  onCancelClose: () => void;
  /** Locks the trigger once already "Closed" — same "no way back in from
   *  here" reasoning `TranscriptSessionSeparator`'s own `isClosed` doc
   *  comment covers. */
  disabled?: boolean;
  /** Merged onto the trigger `Button`'s own className — per explicit
   *  request (Agent Workspace 2.0 Phase 1 only), lets
   *  `TranscriptSessionSeparator`'s own `outcomeAfterStatus` reorder this
   *  tag via a flex `order-*` utility without moving any JSX. Omit to
   *  leave the trigger exactly as before. */
  className?: string;
}) {
  return (
    <Popover
      open={menuOpen}
      onOpenChange={onMenuOpenChange}
      placement="bottom"
      align="end"
      className="w-72"
      bodyPadding={menuView === "confirm"}
      header={
        menuView === "confirm" ? (
          <PanelHeader
            title="Close Contact?"
            icon={
              <WarningIconSolid
                className="h-5 w-5 text-lyra-status-critical-strong"
                aria-hidden="true"
              />
            }
            bordered={false}
            className="px-5 pb-0"
          />
        ) : undefined
      }
      footer={
        menuView === "confirm" ? (
          <div className="flex items-center justify-end gap-2 px-5 pb-4 pt-1">
            <Button variant="destructive" size="md" onClick={onConfirmClose}>
              Close
            </Button>
            <Button variant="outline" size="md" onClick={onCancelClose}>
              Cancel
            </Button>
          </div>
        ) : undefined
      }
      content={
        menuView === "confirm" ? (
          <p className="pb-2 pt-1 lyra-body-md text-lyra-fg-secondary">
            Closing a contact cannot be undone. Are you sure you want to close this contact?
          </p>
        ) : (
          <Menu
            bare
            items={TRANSCRIPT_SESSION_STATUS_OPTIONS.map((option) => ({
              id: option.label,
              label: option.label,
              active: option.label === status,
              icon: (
                <span
                  aria-hidden="true"
                  className="block h-2 w-2 rounded-full"
                  style={{ backgroundColor: option.dotColor }}
                />
              ),
              onClick: () => onSelectStatus(option.label),
            }))}
          />
        )
      }
    >
      <Button
        variant="ghost"
        size="sm"
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        className={cn("h-auto shrink-0 rounded-full p-0 disabled:opacity-100", className)}
      >
        <Tag
          label={status}
          variant={TRANSCRIPT_SESSION_STATUS_VARIANT[status] ?? "neutral"}
          shape="pill"
          trailingIcon={
            !disabled && (
              <ChevronDown
                className={cn("transition-transform", menuOpen && "rotate-180")}
                strokeWidth={1.5}
              />
            )
          }
        />
      </Button>
    </Popover>
  );
}

export function TranscriptSessionSeparator({
  session,
  onViewDetails,
  onToggleDetailsPanel,
  detailsPanelOpen = false,
  detailsPanelPreviewContent,
  detailsPanelPreviewOpen = false,
  onDetailsPanelPreviewHoverStart,
  onDetailsPanelPreviewHoverEnd,
  statusMenuOpen,
  statusMenuView,
  onStatusMenuOpenChange,
  onSelectStatus,
  onConfirmClose,
  onCancelClose,
  messageCount,
  outcome,
  onDismiss,
  channelClosed,
  isCurrentSession,
  showActionCluster = true,
  showConsultTransferAndAddParticipant = true,
  showKebabMenu = true,
  outcomeAfterStatus = false,
  // Per explicit follow-up request (Advanced only — "hide the add
  // participant icon button ... move the transfer inside the 3 dots menu
  // ... move the 3 dots to the left of the outcome button and move the
  // status chip to the left of the 3 dots button"): these three are
  // additive/independent of the three props just above, not replacements —
  // `showConsultTransferAndAddParticipant` still hides BOTH buttons
  // together for 2.0 Phase 1's own existing usage; these let a caller keep
  // Consult/Transfer while hiding just Add Participant, folding Transfer
  // into the kebab instead of showing it as its own icon, and reordering
  // Status/Kebab/Outcome independently of `outcomeAfterStatus`'s own
  // status-then-outcome arrangement. See each prop's own doc comment below.
  showAddParticipant = true,
  transferInKebabMenu = false,
  statusAndKebabBeforeOutcome = false,
  controlsReadOnly = false,
  showStatus = true,
  channelType,
  direction,
  isNewThread = false,
  collapsed = false,
  onToggleCollapsed,
  compactHeader = false,
  hideFade = false,
showViewDetails = true,
  viewDetailsLabel = "View Details",
  portalTarget,
}: {
  session: Contact;
  /** Per explicit request, "View Details" no longer expands this session's
   *  own `TranscriptSessionDetails` inline below (the old `open`/`onToggle`
   *  boolean pair this replaces) — it now opens an external `InteriorPanel`
   *  instead (`InteractionTranscript`'s own `onViewSessionDetails` prop,
   *  which each page threads to a real "Session Details" panel, or, for
   *  voice, a tab on the existing "Transcript" panel — see that prop's own
   *  doc comment). This component owns no open/closed state of its own
   *  anymore for this row; it's just a trigger.
   *
   *  Per further explicit follow-up request ("View Details should no
   *  longer toggle the panel open closed but just display the details in
   *  the side panel"): each caller's own handler behind this no longer
   *  closes an already-open panel showing this same session — it always
   *  opens (or stays open on) the panel and shows this session's details,
   *  full stop. The toggle-open/closed behavior moved to the new
   *  `onToggleDetailsPanel` button below instead. */
  onViewDetails: () => void;
  /** Per explicit follow-up request ("customer information, details and
   *  customer summary are all opening in separate panels, they should all
   *  open in one side panel and just replace the current information...
   *  you may need to add a panel icon button to the right of the outcome /
   *  dismiss and unassign buttons in the session row"): a new icon button,
   *  right of Unassign & Dismiss/Delete Draft. Per explicit follow-up
   *  request ("this should say 'Open Details Panel' and just open/close -
   *  the panel not list the options. View Details should no longer toggle
   *  the panel open closed but just display the details in the side
   *  panel"): this used to open a small menu offering a choice of
   *  destinations (Session Details/Customer Information/AI Summary) — that
   *  menu is gone. This is now a single plain toggle: the caller's own
   *  open/closed boolean for the whole Details panel, flipped as-is,
   *  regardless of WHICH content that panel currently shows (this button
   *  has no opinion on that — same "just report the click, no opinion on
   *  what it means" split `onViewDetails` already draws). `onViewDetails`
   *  itself (above) is no longer a toggle either — see its own doc comment
   *  — so this button is now the ONLY thing on a session row that can
   *  close an already-open panel. Omit to skip rendering the button
   *  entirely (nothing else about this row changes either way). */
  onToggleDetailsPanel?: () => void;
  /** Per explicit follow-up request ("hide the toggle icon button when the
   *  session details are open"): hides the `onToggleDetailsPanel` button
   *  above entirely while the caller's Details panel is already open,
   *  rather than leaving it sitting there only able to close the very panel
   *  it's rendered inside the row of — the panel itself is now this row's
   *  own "session details are open" indicator, so the button stays out of
   *  the way until there's actually something for it to open again.
   *  Reflects the caller's real open/closed state (the same state
   *  `onToggleDetailsPanel` flips). Defaults `false`, so a caller that
   *  hasn't wired its own open state through here yet still renders the
   *  button exactly as before, unconditionally, whenever
   *  `onToggleDetailsPanel` is provided. */
  detailsPanelOpen?: boolean;
  /** Per explicit bug report ("when you moved the session detail panel
   *  toggle to the session row line you lost the overlay of the session
   *  details panel itself — now it just shows a tooltip"): before the move,
   *  hovering the record header's own Customer Information toggle showed a
   *  rich preview `Popover` (`CustomerInfoHoverPreview`, still live in
   *  `AgentNextGenPage.tsx`) of the panel's own content, not just a plain
   *  text tooltip — that hover-preview never got carried over when this
   *  button relocated into the session row. Restores the same idea here:
   *  supply this button's own Details-panel content (whatever the caller's
   *  real docked panel would show) and hovering (or focusing) the button
   *  now pops it open right below the button, exactly as before. Omit to
   *  keep the old plain-tooltip-only behavior (nothing else about this row
   *  changes either way) — e.g. a caller with no equivalent preview content
   *  ready to hand over. The caller owns open/close timing itself (see
   *  `detailsPanelPreviewOpen`/`onDetailsPanelPreviewHoverStart`/
   *  `onDetailsPanelPreviewHoverEnd` below), same "parent owns the hover
   *  timer, child just reports hover in/out" split
   *  `CustomerInfoHoverPreview`'s own former call site used. */
  detailsPanelPreviewContent?: React.ReactNode;
  /** Whether `detailsPanelPreviewContent` above is currently showing —
   *  purely a controlled reflection of the caller's own hover-preview state
   *  (see that prop's own doc comment); this component owns none of the
   *  open/close timing itself. Defaults `false`, so a caller that hasn't
   *  wired the preview through yet renders exactly as before. */
  detailsPanelPreviewOpen?: boolean;
  /** Fired on hover-in (`onMouseEnter`) or keyboard focus (`onFocus`) of the
   *  "Open Details Panel" button — the caller's own cue to open
   *  `detailsPanelPreviewContent` (typically after clearing any pending
   *  close timer, same "open immediately" half of the hover-intent pattern
   *  `CustomerInfoHoverPreview`'s own former trigger used). No-op (button
   *  still renders as a plain tooltip-only toggle) when
   *  `detailsPanelPreviewContent` is omitted. */
  onDetailsPanelPreviewHoverStart?: () => void;
  /** Fired on hover-out (`onMouseLeave`) or blur (`onBlur`) of the same
   *  button — the caller's own cue to schedule closing the preview (a short
   *  delay, so the pointer can cross into the portaled preview content
   *  itself without it flickering shut — see `CustomerInfoHoverPreview`'s
   *  own former close handler for the exact shape). Receives the raw
   *  mouse/focus event so a caller that needs to inspect `relatedTarget`
   *  (e.g. to not close into its own nested overflow menu) still can. */
  onDetailsPanelPreviewHoverEnd?: (e: React.MouseEvent | React.FocusEvent) => void;
  /** This session's own message (chat bubble) count — shown as "{n}
   *  Messages | " right before "# contactId · date", same "Messages | #id"
   *  format `ChannelTab`'s own tooltip line already uses (channel-row.tsx)
   *  for the identical fact. Omit entirely (not `0`) for a channel with no
   *  real per-message transcript to count — Voice/Email's sessions only
   *  ever hold a placeholder `messages: []` (see `TRANSCRIPT_SESSIONS_VOICE`/
   *  `_EMAIL`'s own doc comment), so "0 Messages" there would misreport a
   *  call/email as an empty chat rather than just not applying. Only passed
   *  for chat/SMS/WhatsApp (`InteractionTranscript`'s own call site checks
   *  `channelType`), where `messages.length` is a real, meaningful count. */
  messageCount?: number;
  /** Whether THIS session's status popover is the one currently open —
   *  `InteractionTranscript`'s `statusMenuOpenId` only ever names one
   *  session at a time, same pattern as `tagPickerOpenId` for message tag
   *  pickers. */
  statusMenuOpen: boolean;
  /** Which body the (currently open) popover shows: the Open/Pending/
   *  Escalated/Resolved/Closed list, or the "Close Contact?" confirm.
   *  Meaningless while `statusMenuOpen` is false. */
  statusMenuView: "menu" | "confirm";
  onStatusMenuOpenChange: (open: boolean) => void;
  /** A non-"Closed" status was picked straight from the list — applies
   *  immediately and closes the popover. Picking "Closed" itself doesn't
   *  call this; see `onConfirmClose` below. */
  onSelectStatus: (status: string) => void;
  /** "Close" clicked on the confirm view — actually applies the "Closed"
   *  status and closes the popover. */
  onConfirmClose: () => void;
  /** "Cancel" clicked on the confirm view — closes the popover without
   *  changing anything (the status stays whatever it was before "Closed"
   *  was picked from the list). */
  onCancelClose: () => void;
  /** Real Consult/Transfer + Outcome buttons, floated right of the "#
   *  contactId · date" pill — per explicit request. Only meaningful/passed
   *  for the CURRENT session (`InteractionTranscript`'s `lastSessionId`)
   *  since it's the same live `ChannelOutcomeConfig` shape (and, via
   *  `resolution`/`onResolutionChange`, the exact same underlying value)
   *  the LeftNav's own `ChannelRow` Outcome button already uses for this
   *  same channel — opening either one shows the identical popover/draft.
   *  Historical sessions get the Transfer icon too (purely decorative,
   *  same as everywhere else in this app — see rule #30) but no working
   *  Outcome popover, since there's no real per-historical-session outcome
   *  state to back one. */
  outcome?: ChannelOutcomeConfig;
  /** Real "Unassign & Dismiss" button, immediately right of the status tag
   *  — per explicit request. Same "current session only" scoping as
   *  `outcome` above (see `InteractionTranscript`'s own `onDismissChannel`
   *  doc comment): a historical session has no live channel left to
   *  dismiss, so this is `undefined` there and the button doesn't render
   *  at all (no decorative/disabled version — unlike Transfer, this is a
   *  real destructive action, not a static icon, so there's nothing
   *  meaningful to show non-functionally). */
  onDismiss?: () => void;
  /** True once the whole CHANNEL/interaction this session belongs to reads
   *  as closed/read-only — same union of conditions `InteractionTranscript`'s
   *  own `dimmed` prop is already built from (`Interaction.closed` OR
   *  this channel's own `threadStatuses` entry reading "Closed" — see that
   *  prop's own doc comment for the full picture). */
  channelClosed?: boolean;
  /** True only for the CURRENT session — `InteractionTranscript`'s own
   *  `lastSessionId` check, passed down rather than re-derived here. Per
   *  explicit request/bug report: `isClosed` below used to read THIS
   *  session's own `status` field ("Closed" or not) instead of this — a
   *  real, confirmed bug, since a Thread can accumulate more than one
   *  historical session whose own logged status was never literally
   *  "Closed" (e.g. two "Resolved" mock sessions stacked in
   *  `TRANSCRIPT_SESSIONS`), which showed as two simultaneously "open"
   *  looking rows, both with a seemingly-live Consult/Transfer + Outcome
   *  cluster. There should never be more than one non-Closed session in a
   *  Thread — only the current one is ever actually live — so `isClosed`
   *  now derives purely from POSITION (is this the current session, or
   *  not) rather than trusting each session's own possibly-stale `status`
   *  field. See `InteractionTranscript`'s own `getSessionStatus` for the
   *  matching fix on the DISPLAYED status label (every non-current session
   *  now always reads "Closed", regardless of what it was logged with). */
  isCurrentSession: boolean;
  /** Per explicit request (Agent Workspace 2.0 only — see
   *  `AgentNextGenPage.tsx`'s own `showSessionActionCluster` doc comment at
   *  its `InteractionTranscript` call site): once that record header grew
   *  its own icon-button cluster covering these exact same actions (plus a
   *  relocated copy of the status tag itself), this row's own copy became
   *  redundant. Defaults `true` (Premium/Advanced, and every other call
   *  site, keep the cluster exactly as before — only the one 2.0 call site
   *  threads `false` through). */
  showActionCluster?: boolean;
  /** Hides just the "Add Participant" and "Consult / Transfer" icon
   *  buttons within this cluster, leaving the status tag, Outcome, and
   *  "Unassign & Dismiss" untouched — per explicit request (Agent Workspace
   *  2.0 Phase 1 only). Independent of `showActionCluster` above (which
   *  hides the whole cluster): a consumer can hide just these two buttons
   *  while keeping everything else in the cluster exactly as before.
   *  Default `true` (every other call site keeps both buttons). */
  showConsultTransferAndAddParticipant?: boolean;
  /** Hides just the "More Options" kebab (Send/Download Transcript,
   *  Translate Messages) within this cluster, leaving the status tag,
   *  Consult/Transfer, and Outcome untouched — per explicit request (Agent
   *  Workspace 2.0 Phase 1 only). Independent of `showActionCluster` and
   *  `showConsultTransferAndAddParticipant` above. Default `true` (every
   *  other call site keeps the kebab). */
  showKebabMenu?: boolean;
  /** Reorders just this session row's Outcome button to render AFTER the
   *  status tag (and, once a session reads "Closed," after the collapse/
   *  expand chevron and Unassign & Dismiss/close button too — this moves
   *  Outcome to the very end of the visible cluster) — via flex `order-*`
   *  utilities on each element, not by physically reordering the JSX, so
   *  every element's OWN gating logic (isClosed/isNewThread/etc., right
   *  above each one) stays untouched. Per explicit request (Agent
   *  Workspace 2.0 Phase 1 only). Default `false` (every other call site
   *  keeps Outcome in its original, leading position). */
  outcomeAfterStatus?: boolean;
  /** Hides just the "Add Participant" icon button within this cluster,
   *  leaving Consult/Transfer, the status tag, Outcome, and "Unassign &
   *  Dismiss" untouched — per explicit follow-up request (Advanced only).
   *  ANDed with `showConsultTransferAndAddParticipant` above (both must be
   *  true for Add Participant to render) rather than a replacement for it,
   *  so 2.0 Phase 1's existing "hide both together" usage is unaffected.
   *  Default `true` (every other call site keeps Add Participant). */
  showAddParticipant?: boolean;
  /** Per explicit follow-up request (Advanced only, same request as
   *  `showAddParticipant` above): hides the standalone "Consult / Transfer"
   *  icon button and instead adds a "Consult / Transfer" row to the kebab
   *  ("More Options") menu just below, reusing the same `TransferIcon` and
   *  sitting first in that menu's item list. Purely decorative/unwired,
   *  same as the standalone button it replaces (see that button's own doc
   *  comment/rule #30) — clicking it does nothing yet either. Has no effect
   *  while `showKebabMenu` is false (nowhere to add the row to) or while
   *  `showConsultTransferAndAddParticipant` is false (Transfer already
   *  hidden outright). Default `false` (every other call site keeps
   *  Transfer as its own standalone icon). */
  transferInKebabMenu?: boolean;
  /** Reorders this session row's status tag, kebab, and Outcome button to
   *  render in that exact sequence (status tag first, then kebab, then
   *  Outcome) — via flex `order-*` utilities on each element, same
   *  technique `outcomeAfterStatus` above already uses, not by physically
   *  reordering the JSX, so every element's own gating logic stays
   *  untouched. Collapse/Unassign & Dismiss/"Open Details Panel" keep
   *  their existing relative order, just pushed after Outcome. Independent
   *  of `outcomeAfterStatus` above (which only reorders status-then-
   *  outcome, leaving the kebab in its default position) — the two are
   *  never combined at the same call site today, but use distinct `order-*`
   *  values regardless so nothing would collide if they ever were. Per
   *  explicit follow-up request (Advanced only). Default `false` (every
   *  other call site keeps this cluster in its original DOM order). */
  statusAndKebabBeforeOutcome?: boolean;
  /** Locks the status tag, kebab, and Outcome button — visibly present but
   *  non-interactive (`disabled`), NOT hidden — while leaving everything
   *  else in this row (including "Open Details Panel") untouched. Distinct
   *  from `isClosed` (below), which additionally hides Consult/Transfer/
   *  Add Participant/Unassign & Dismiss entirely for a session that's
   *  genuinely over; this is for a temporary, still-open state where the
   *  agent just shouldn't be able to change status/outcome/reach kebab
   *  actions yet — e.g. while reviewing an AI agent's still-live
   *  conversation before deciding whether to take it over. Per explicit
   *  request. Default `false` (every other call site is unaffected). */
  controlsReadOnly?: boolean;
  /** Hides the status pill when the provider doesn't store case status
   *  (hide, don't disable — P0.5d.1). Default `true`. */
  showStatus?: boolean;
  /** This channel's real, typed channel — passed straight through from
   *  `InteractionTranscript`'s own `channelType` prop (one instance renders
   *  every historical session for a single channel, so this is the same
   *  value for all of them). Only actually used to pick an icon (voice/sms
   *  — see `direction` right below) next to the `session.channel` display
   *  label already rendered in the date cluster; every other channel type
   *  renders that label with no icon at all, same as before this feature
   *  existed. Per explicit request (Agent Workspace 2.0 Phase 1 & Phase 2
   *  only) — omit entirely to render with no icon, exactly as before. */
  channelType?: ChannelType;
  /** Whether this channel was customer-initiated ("inbound") or agent-
   *  initiated ("outbound") — passed straight through from
   *  `InteractionTranscript`'s own prop of the same name. Combined with
   *  `channelType` right above to render `VoiceDirectionIcon`/
   *  `SmsDirectionIcon` (lyra-ui, channel-row.tsx) next to the
   *  `session.channel` label — the exact same icon treatment Contact
   *  History and `InteractionNavItem` use for this same channel, so all
   *  three surfaces read as one consistent system. Per explicit request
   *  (Agent Workspace 2.0 Phase 1 & Phase 2 only) — omit to render with no
   *  icon, exactly as before. */
  direction?: ChannelDirection;
  /** True for a brand-new, agent-initiated OUTBOUND thread with no real
   *  history yet (`Interaction.startedFresh` — passed straight through
   *  from `InteractionTranscript`'s own prop of the same name; see that
   *  prop's own doc comment for the full "outbound vs. customer-initiated"
   *  reasoning). Per explicit request: a thread in this state hasn't
   *  earned Consult/Transfer, Outcome, or Unassign & Dismiss yet — there's
   *  no one to transfer to, no outcome to log, and nothing to unassign
   *  from — so all three are hidden here (current session only; a
   *  historical session already hides them via `isClosed`, `isNewThread`
   *  doesn't change that). The status tag stays (still meaningful — a
   *  fresh thread is genuinely "Open", not blank), and in place of the
   *  red Unassign & Dismiss button, a red trash-icon "Delete Draft" button
   *  takes over `onDismiss`'s wiring — same delete-draft markup lyra-ui's
   *  own `ChannelRow`/`ChannelTab` already fall back to once THEIR kebab is
   *  similarly hidden (`removable`/`removeVariant`/`showMenu`, channel-
   *  row.tsx), reused here for visual consistency across all three "new
   *  thread" surfaces.
   *  Per an explicit clarifying follow-up, only ever `true` for outbound —
   *  a new thread opened BY the customer keeps the full normal cluster,
   *  same as any other live thread with real history. Defaults `false`;
   *  every existing call site is unaffected until `InteractionTranscript`
   *  starts threading a real value through. */
  isNewThread?: boolean;
  /** Whether this CLOSED session's transcript content — this session's own
   *  message bubbles, rendered by `InteractionTranscript` as a sibling of
   *  this whole component, not a child of it — is currently collapsed
   *  away. Purely a display flag here: this component owns no message
   *  content itself, so `collapsed` only drives which icon
   *  (`ChevronsDownUp`/`ChevronsUpDown`) the collapse button next to the
   *  status tag shows; `InteractionTranscript` is what actually animates
   *  its own message-content wrapper open/shut off this same session's
   *  `collapsedSessionIds` entry. */
  collapsed?: boolean;
  /** Toggles `collapsed` for this session. Passing this is what renders the
   *  collapse icon at all, immediately right of the status tag — same
   *  "which direction does the next click applies" idiom lyra-ui's own
   *  `AssignmentsExpandCollapseAllButton` uses. Only ever shown for a
   *  session whose status reads "Closed" (`session.status`, via
   *  `InteractionTranscript`'s own `getSessionStatus`) — an in-progress
   *  session has nothing to collapse away yet. */
  onToggleCollapsed?: () => void;
  /** Per explicit request: below 768px of the transcript's own container
   *  width, the left-hand "{n} Messages | # contactId · date" cluster hides
   *  entirely, leaving only "View Details" + the expand/collapse chevron —
   *  the goal being to keep the right-hand action cluster (Consult/
   *  Transfer, Outcome, status tag, Unassign & Dismiss) pinned on the same
   *  row instead of wrapping onto its own line (`flex-wrap` on the row
   *  above) as the container narrows. `InteractionTranscript`'s own call
   *  site passes its already-measured `transcriptBubbleFullWidth` (see that
   *  state's own doc comment — the SAME `<768px` ResizeObserver reading
   *  the chat-bubble-width breakpoint already uses, off the same scroll
   *  container this row lives in) rather than this component measuring its
   *  own width a second time. Defaults `false` — every other call site (if
   *  any are ever added) keeps the full label. */
  compactHeader?: boolean;
  /** Suppresses this separator's own trailing bottom fade (see that div's
   *  doc comment just below for what it normally does). Only ever needed
   *  for a session whose FIRST piece of scrolling content underneath is
   *  the `ContactOverview` block (`InteractionTranscript`'s own
   *  `contactOverview` prop) — that block sits flush against this
   *  separator, so the fade's `-bottom-8` band was painting straight over
   *  its "Contact Overview" heading instead of just softening real
   *  message bubbles further down. Every other session (fade landing on
   *  actual messages, which is the whole point) leaves this `false`. */
  hideFade?: boolean;
  /** Per explicit request: the "Transcript" tab of voice's own combo
   *  "Session Details"/"Transcript" `InteriorPanel` renders a second,
   *  nested `InteractionTranscript` instance (see that panel's own render
   *  site) — its own session rows no longer need a "View Details" trigger,
   *  since clicking it would just jump to the SAME panel's own "Details"
   *  tab, one tab over from where the agent already clicked from. `false`
   *  there (via `InteractionTranscript`'s own `showViewDetails` prop)
   *  drops the "View Details" text + chevron entirely, leaving the plain
   *  "{n} Messages | # contactId · date" cluster as inert (non-`Button`)
   *  text — every other call site keeps the default `true`. */
showViewDetails?: boolean;
  /** Per explicit follow-up request, Phase 1 (Advanced) only ("rename the
   *  view details link 'Session Details'") — overrides this link's own
   *  text. Defaults to "View Details", unchanged for every other consumer
   *  (Premium, Agent Workspace 2.0) that doesn't pass this. */
  viewDetailsLabel?: string;
  /** Per explicit request ("move the session row into the page header
   *  container so when the details are opened they look like the attached
   *  screenshot, instead of overlaying the session row"): when a real DOM
   *  node is passed, this row's entire rendered content (the "{n} Messages
   *  | # contactId · date | View Details" cluster AND the Consult/
   *  Transfer/Outcome/status-tag/Unassign & Dismiss cluster alongside it)
   *  is rendered via `createPortal` into THAT node instead of inline here
   *  — physically relocating it out of the scrollable transcript column
   *  (and out from underneath the "Session Details" `InteriorPanel`, which
   *  shares that same column and outranks this row's own `z-[1]` sticky
   *  separator with its own `z-[3]`, hence "overlaying") and into the
   *  record header's own container instead, which sits structurally
   *  outside/above that whole column and is never covered by the panel
   *  regardless of z-index. The caller (each tier page) renders a plain,
   *  unstyled `<div ref={...}>` inside its own record header for this to
   *  portal into, and threads the resulting node down through
   *  `InteractionTranscript`'s own `sessionRowPortalTarget` prop (see that
   *  prop's own doc comment) — only ever supplied for the CURRENT session
   *  at that call site, so a historical session (if one somehow renders)
   *  is unaffected. Omit (the default, every other tier/call site) to
   *  render this row inline exactly as before — this component has zero
   *  behavior change with no target supplied. */
  portalTarget?: HTMLElement | null;
}) {
  const isClosed = !isCurrentSession || !!channelClosed;
  // Per explicit follow-up request ("also in the interaction more options 3
  // dots add a tooltip that says more options (like in the
  // interactionNavItem)"): mirrors `ChannelRow`'s own `menuOpen` state
  // (channel-row.tsx) used to suppress its "More Options" tooltip while the
  // kebab dropdown itself is open, so the tooltip doesn't linger/overlap the
  // open menu here either.
  const [kebabMenuOpen, setKebabMenuOpen] = useState(false);
  // The "Open Details Panel" button itself, computed once here (rather than
  // inline below) so both the plain and hover-preview-wrapped renderings
  // (see `detailsPanelPreviewContent`'s own doc comment above) share the
  // exact same markup with zero duplication — only whether it's wrapped in
  // a `Popover` differs.
  const detailsPanelButton = onToggleDetailsPanel && !detailsPanelOpen ? (
    <Button
      variant="ghost"
      size="icon-sm"
      title="Open Details Panel"
      className={cn("shrink-0 text-lyra-fg-secondary", outcomeAfterStatus && "order-5", statusAndKebabBeforeOutcome && "order-6")}
      onClick={(e: React.MouseEvent) => {
        e.stopPropagation();
        onToggleDetailsPanel();
      }}
      // Per the hover-preview restoration above — no-ops (undefined) when
      // the caller hasn't wired `detailsPanelPreviewContent` through, same
      // as `CustomerInfoHoverPreview`'s own former trigger button wired
      // both pointer AND keyboard-focus hover-intent (mirrors it exactly).
      onMouseEnter={onDetailsPanelPreviewHoverStart}
      onMouseLeave={onDetailsPanelPreviewHoverEnd}
      onFocus={onDetailsPanelPreviewHoverStart}
      onBlur={onDetailsPanelPreviewHoverEnd}
    >
      <PanelRight className="h-3.5 w-3.5" strokeWidth={1.5} />
    </Button>
  ) : null;
  // `content` (not a direct `return`) so `portalTarget` (this component's
  // own prop, doc comment above) can relocate the exact same JSX into the
  // record header via `createPortal` further down, with zero duplication.
  const content = (
    // Plain `div` pair — was `AccordionHeadless`/`AccordionHeadlessItem`
    // (a headless accordion, chosen back when "View Details" expanded
    // `TranscriptSessionDetails` inline right below via `AccordionHeadless
    // Content`). Per explicit request, "View Details" now opens an external
    // `InteriorPanel` instead (see `onViewDetails`'s own doc comment) — this
    // row no longer has any open/closed state of its own to animate, so the
    // accordion primitives (and the `AccordionHeadlessContent` body they
    // wrapped) are gone; the same two classNames move straight onto plain
    // `div`s so the sticky/border behavior is otherwise untouched.
    <div
      // Per explicit follow-up request, un-reverting an earlier revert
      // ("dang - revert that last change - go back to full screen width"):
      // back to full-width again — the outer scroll wrapper (`Interaction
      // Transcript`'s own call site, see its doc comment) is unconstrained
      // (`w-full`, no max-width) once more, so this root carries its own
      // `px-6` directly again instead of inheriting a constrained parent's
      // inset. `px-6` lives HERE (not on a wrapping div) for the same
      // sticky-containing-block reasoning already established: a sticky
      // element's stickiness bounds are its own immediate parent's box — a
      // wrapper holding ONLY this separator has zero extra height to stick
      // through. This root stays a DIRECT sibling of the per-session
      // message content (both children of the same `<div key={session.id}>`,
      // which has real height) — that part was never touched by either the
      // revert or this un-revert.
      className={cn(
        "bg-lyra-bg-surface-base px-6",
        // Sticky-within-the-scroll-column positioning only makes sense
        // for the inline (non-portaled) rendering — see this className's
        // own doc comment just above for the "stickiness bounds are its
        // own immediate parent's box" reasoning, which no longer applies
        // once `portalTarget` relocates this whole row into the record
        // header's own, non-scrolling container instead.
        !portalTarget && "sticky top-0 z-[1]",
      )}
    >
      {/* `border-b border-lyra-border-subtle` lives on this row wrapper, not
          the sticky root above (a first attempt there didn't render — see
          this comment's own history) — now that "View Details" opens an
          external panel instead of expanding content below, this is simply
          the bottom border of the collapsed row. */}
      <div className="border-b border-lyra-border-subtle">
        <div className="flex flex-wrap items-center justify-between gap-3 py-2">
          {/* Flat, left-aligned case info — no wrapping pill border/
              background and no flanking divider lines (per earlier design
              update matching the reference screenshot): plain inline
              content. The status tag itself sits at the far right (see the
              Consult/Transfer + Outcome cluster below). Customer name +
              channel address used to sit here too, ahead of "# contactId ·
              date" — per explicit follow-up request, dropped as redundant
              (not just hidden): both are already shown elsewhere for this
              same conversation (the record-header tab's own face/tooltip,
              the Customer Information panel), so repeating them on every
              single session row added noise without new information. This
              component no longer takes `customerName`/`channelAddress`
              props at all as a result — see `InteractionTranscript`'s own
              call site, which no longer passes them either. (A later
              follow-up briefly reinstated `customerName` here, conditional
              on the Customer Information panel being closed — once that
              panel permanently docked to the right of the page, the
              condition itself stopped applying, so this was dropped again
              for good rather than kept as another toggle.)

              `flex-wrap` on the row above — per explicit follow-up request,
              when the container narrows the Consult/Transfer + Outcome +
              status tag cluster should break onto its own line rather than
              clipping/overflowing (an earlier overflow-hidden/truncate
              attempt was the wrong read of the request — undone here). The
              right-hand cluster below lost its `ml-auto` for the same
              reason — it now left-aligns under this cluster once wrapped,
              rather than floating to the far right on its own line. */}
          <div className="flex flex-wrap items-center gap-1.5 lyra-body-sm text-lyra-fg-secondary">
            {/* "# contactId · date" + "View Details" + the expand/collapse
                chevron — per explicit request, stays a real, always-
                toggleable `Button` regardless of `isClosed`: a closed
                session's own Session Details can still be opened/collapsed
                to review it, same as an open one — only the status chip/
                composer/etc. actually lock down once closed, not this.
                (Previously swapped to plain, non-interactive text here once
                `isClosed` — that's been removed.)

                Per a later explicit request, "View Details" is now real,
                always-visible text (a link-styled span, `text-lyra-fg-link`
                — same token `DesktopDesignsPage.tsx`'s own inline text link
                uses) between the date and the chevron, not just a hover
                tooltip — the `Tooltip` that used to carry this exact same
                string on hover was removed as redundant once the text
                itself is always on-screen. The "{n} Messages | # contactId ·
                date" portion is now its own inner `span` (its own
                `inline-flex items-center gap-1.5` to keep that internal
                spacing once it's no longer a set of direct flex children of
                the outer `Button`) so it can be hidden as one unit via
                `compactHeader` (that prop's own doc comment) — leaving just
                "View Details" + the chevron once the container narrows
                below 768px, which is the whole point: less content on this
                side means the right-hand action cluster has room to stay on
                this same row instead of wrapping under it. */}
            {/* The "{n} Messages | # contactId · date" cluster — shared
                between the interactive `Button` below (the normal case)
                and the plain, non-interactive `span` `showViewDetails`
                (this prop's own doc comment) falls back to once "View
                Details" itself is hidden — same content either way, just a
                different wrapper. */}
            {(() => {
              const dateCluster = (
                <span className={cn("inline-flex items-center gap-1.5", compactHeader && "hidden")}>
                  {/* Per explicit follow-up request ("add the channel type
                      to the summary row at the left (voice, sms, webchat,
                      chat, whatsapp, etc.)") — `session.channel` is already
                      a real, populated display label on every `Contact`
                      this row ever renders (`freshSessionChannelLabel`/the
                      historical mock arrays above all set it), so this just
                      surfaces it rather than adding a new field. Grouped
                      inside this same collapsible span (not a separate
                      always-visible one) so it hides together with the
                      rest of this cluster under `compactHeader`, same
                      reasoning as every other piece here. */}
                  {/* Direction icon — per explicit request (Agent Workspace
                      2.0 Phase 1 & Phase 2 only): voice/sms sessions get a
                      `VoiceDirectionIcon`/`SmsDirectionIcon` (lyra-ui,
                      channel-row.tsx) right before the text label, the same
                      icon Contact History/`InteractionNavItem` render for
                      this same channel. Every other `channelType` (and
                      voice/sms with no `channelType`/`direction` passed at
                      all) renders no icon here, exactly as before this
                      feature existed. */}
                  {channelType === "voice" && (
                    <VoiceDirectionIcon direction={direction} className="h-3 w-3" />
                  )}
                  {channelType === "sms" && (
                    <SmsDirectionIcon direction={direction} className="h-3 w-3" />
                  )}
                  <span>{session.channel}</span>
                  <span aria-hidden="true">|</span>
                  {messageCount != null && (
                    <>
                      <span>{messageCount} Message{messageCount === 1 ? "" : "s"}</span>
                      <span aria-hidden="true">|</span>
                    </>
                  )}
                  {/* Per explicit request ("display the number in the
                      session row instead of the contact ID — display
                      email/whatsapp handle/etc. for phase 2"):
                      `session.addressLabel` (set from the live channel's
                      own `Thread.addressLabel` — already a generic "phone
                      number/email address/WhatsApp handle" string, so this
                      one field covers every channel type with no extra
                      per-type branching needed) takes over from the "#
                      contactId" display whenever it's known. The bare "#"
                      glyph only makes sense ahead of an actual ID, not a
                      phone number/email/handle, so it's dropped along with
                      `contactId` rather than kept as a stray leading
                      character. Falls back to the exact original "#
                      contactId" display whenever no address is known
                      (every historical mock session, an ad-hoc/redialed
                      channel with nothing stored) — see `Contact.
                      addressLabel`'s own doc comment. */}
                  {session.addressLabel ? (
                    <>
                      {/* `formatPhoneForDisplay` normalizes this regardless
                          of whether the raw `Thread.addressLabel` this came
                          from was ever actually formatted upstream — a
                          no-op for a non-phone-shaped address
                          (email/WhatsApp handle), see that function's own
                          doc comment. */}
                      <span>{formatPhoneForDisplay(session.addressLabel)}</span>
                      {/* Per explicit request: the trailing slot after the
                          address now shows the Contact ID instead of the
                          date — the date no longer appears in this summary
                          row at all (it's still shown in the expanded
                          Session Details panel, see
                          `TranscriptSessionDetails` below). Only rendered
                          here when `addressLabel` is set — when it isn't,
                          the contactId is already the leading slot (else
                          branch below), so repeating it here would just
                          duplicate it. */}
                      <span aria-hidden="true">·</span>
                      <span aria-hidden="true">#</span>
                      <span>{session.contactId}</span>
                    </>
                  ) : (
                    <>
                      <span aria-hidden="true">#</span>
                      <span>{session.contactId}</span>
                    </>
                  )}
                </span>
              );
              return showViewDetails ? (
                <Button
                  variant="ghost"
                  onClick={onViewDetails}
                  // Same `hover:bg-transparent active:bg-transparent`
                  // override as the status-tag `Button` above, and for the
                  // same reason — the wrapping pill div owns the one,
                  // whole-pill hover now.
                  className="h-auto shrink-0 gap-1.5 p-0 hover:bg-transparent active:bg-transparent lyra-body-sm text-lyra-fg-secondary"
                >
                  {dateCluster}
                  {/* Divider between the date cluster and "View Details" —
                      same plain "|" glyph this row already uses for the
                      messageCount/contactId divider above, for visual
                      consistency. Hidden together with the date cluster
                      under `compactHeader` (rather than its own separate
                      condition) since it only means anything as a
                      separator BETWEEN two visible things — once the date
                      cluster hides, there's nothing left of "View Details"
                      for a leading divider to separate it from. */}
                  {!compactHeader && <span aria-hidden="true">|</span>}
                  {/* Per explicit follow-up request, Phase 1 (Advanced)
                      only ("rename the view details link 'Session
                      Details'") — `viewDetailsLabel` (default "View
                      Details", below) lets that one tier's own label read
                      "Session Details" without touching Premium/Agent
                      Workspace 2.0's identical link. Everything else about
                      this link (styling, the external panel it opens via
                      `onViewDetails`, the `showViewDetails`/`compactHeader`
                      gating above) is unchanged. Every doc comment
                      elsewhere in this file still says "View Details" when
                      describing this feature's own history — left as-is,
                      since they're accurately describing what was true
                      when written, not the current label. */}
                  <span className="text-lyra-fg-link hover:underline">{viewDetailsLabel}</span>
                  {/* Static now — was a `ChevronDown`/`ChevronRight` toggle
                      mirroring the old inline-expand `open` state; "View
                      Details" is a one-way navigation trigger now (opens an
                      external panel), not an expand/collapse control, so a
                      single non-animating disclosure chevron is the correct
                      affordance. */}
                  <ChevronRight className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
                </Button>
              ) : (
                <span className="inline-flex h-auto shrink-0 items-center gap-1.5 p-0 lyra-body-sm text-lyra-fg-secondary">
                  {dateCluster}
                </span>
              );
            })()}
          </div>
          {/* Consult/Transfer + Outcome — same real buttons/icons
              `ChannelRow`'s own trailing cluster uses (channel-row.tsx). No
              more `ml-auto` on this cluster itself — that pinned it to the
              row's far right edge even once it wrapped onto its own line
              (reported via screenshot), which reads as floating rather than
              a natural line break. The row above now uses `justify-between`
              instead: while both clusters share one line, it still pushes
              this one flush to the row's right edge (identical look to
              before); once this cluster wraps onto its own line, being the
              lone item on that line means `justify-between` places it at
              that line's start (left) instead — exactly `flex-start`'s
              behavior for a single flex item, no `ml-auto` needed either
              way. Consult/Transfer has no real action anywhere in this app yet
              (see rule #30) — same static, unwired icon button here.
              Outcome IS real when `outcome` is passed (the current
              session only — see this prop's own doc comment): the exact
              same popover UI `ChannelRow`'s Outcome button renders,
              reusing its shared `outcomeDraftKey`/`outcomeDraft` state one
              level up so opening it here or from the LeftNav card shows
              the identical draft. `gap-1` (4px) between every item in this
              cluster (Transfer, Outcome, status chip, Unassign & Dismiss)
              — per explicit request, was `gap-0` (flush together). Per
              later explicit follow-up, this whole cluster (Transfer,
              Outcome, status chip, Unassign & Dismiss alike) is gated on
              `showActionCluster` — see that prop's own doc comment for the
              2.0-only reasoning. */}
          {showActionCluster && (
          <div className="shrink-0 flex items-center gap-1">
            {/* Per explicit follow-up request: once this SESSION reads
                "Closed" (`isClosed` — the exact same flag that already
                locks the status tag below), Consult/Transfer/Outcome/
                Unassign & Dismiss are removed entirely, not just disabled
                — there's nothing left to transfer, log an outcome for, or
                unassign from on a session that's already closed out, so no
                dead icon should linger there either. (First pass just
                `disabled`-grayed these — per this follow-up, that wasn't
                far enough.) The status tag itself is untouched here — it's
                not one of these icons, and still needs to show "Closed" as
                its own label. */}
            {/* Add Participant — leading item in this cluster, immediately
                left of Consult/Transfer, per explicit request/reference
                screenshot. Purely decorative/unwired, same as Transfer
                right next to it (see that button's own doc comment/rule
                #30) — there's no real multi-party call model in this
                prototype for this to add anyone to. Same `!isClosed &&
                !isNewThread` gate as the rest of this cluster: nothing to
                add a participant to on a closed or still-draft thread
                either. */}
            {showConsultTransferAndAddParticipant && showAddParticipant && !isClosed && !isNewThread && (
              <Button variant="icon" size="icon-sm" title="Add Participant" className="text-lyra-fg-secondary">
                <UserPlus className="h-4 w-4" strokeWidth={1.5} />
              </Button>
            )}
            {showConsultTransferAndAddParticipant && !transferInKebabMenu && !isClosed && !isNewThread && (
              <Button variant="icon" size="icon-sm" title="Consult / Transfer" className="text-lyra-fg-secondary">
                <TransferIcon />
              </Button>
            )}
            {!isNewThread && (outcome && !isClosed ? (
              // Shared with the LeftNav's own `ChannelRow` Outcome button —
              // lyra-ui's `OutcomePanel` owns the Status/Tags/Disposition/
              // Summary form (and the Resolution dropdown's own local
              // open/view state) so this session row can't drift into a
              // second, hand-kept-in-sync copy of the same popover again.
              // Tooltip wraps `OutcomePanel` from the OUTSIDE (a plain
              // `<span className="inline-flex">` for Radix's `asChild` to
              // clone onto), with `disabled={outcome.open}` — same fix,
              // same reasoning, as `ChannelRow`'s own Outcome button
              // (channel-row.tsx): a plain `title`-driven `Button` tooltip
              // has no way to suppress itself once the popover it sits on
              // is open, so the "Outcome" hover label could still be
              // showing (the pointer is still resting on this same button
              // right after the click that opened it) at the same time as
              // the popover card, visibly bleeding out from behind/beside
              // it.
              <Tooltip content="Outcome" placement="bottom" className="z-[10020]">
                <span className="inline-flex">
                  <OutcomePanel outcome={outcome} alignOffset={-20}>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label="Outcome"
                      disabled={controlsReadOnly}
                      className={cn("gap-1.5 text-lyra-fg-default", outcomeAfterStatus && "order-2", statusAndKebabBeforeOutcome && "order-3")}
                      onClick={(e: React.MouseEvent) => e.stopPropagation()}
                    >
                      {/* Per explicit request ("make the outcome check button
                          a solid blue circle"): swaps the outline `CircleCheck`
                          lucide icon for lyra-ui's own `SuccessIconSolid` (a
                          filled circle + white checkmark, recolorable via
                          `text-*` since its circle is `fill="currentColor"`)
                          — same component `WarningIconSolid` a few hundred
                          lines up already uses for its own solid badge. Kept
                          the existing `text-lyra-status-info-strong` blue tint
                          rather than switching to the icon's "success" green
                          default, matching the blue this Outcome icon has
                          always used. */}
                      <SuccessIconSolid className="h-4 w-4 text-lyra-status-info-strong" />
                      {/* Per explicit request: in the session row, Outcome is a
                          ghost button with a visible label next to the solid
                          blue check. The interactionNavItem / ChannelRow
                          Outcome button stays icon-only (not touched). */}
                      <span>Outcome</span>
                    </Button>
                  </OutcomePanel>
                </span>
              </Tooltip>
            ) : (
              // Also covers the `outcome && isClosed` case now (the real
              // popover above is gated on `!isClosed` too) — a historical
              // session with no `outcome` prop at all already rendered
              // nothing here once THIS branch itself is skipped for
              // `isClosed`, so a just-closed CURRENT session reads
              // identically (no icon) rather than a static disabled one.
              !isClosed && (
                <Button variant="ghost" size="sm" title="Outcome" disabled={controlsReadOnly} className={cn("gap-1.5 text-lyra-fg-default", outcomeAfterStatus && "order-2", statusAndKebabBeforeOutcome && "order-3")}>
                  {/* Per explicit request ("make the outcome check button
                      a solid blue circle"): swaps the outline `CircleCheck`
                      lucide icon for lyra-ui's own `SuccessIconSolid` (a
                      filled circle + white checkmark, recolorable via
                      `text-*` since its circle is `fill="currentColor"`)
                      — same component `WarningIconSolid` a few hundred
                      lines up already uses for its own solid badge. Kept
                      the existing `text-lyra-status-info-strong` blue tint
                      rather than switching to the icon's "success" green
                      default, matching the blue this Outcome icon has
                      always used. */}
                  <SuccessIconSolid className="h-4 w-4 text-lyra-status-info-strong" />
                  <span>Outcome</span>
                </Button>
              )
            ))}
            {/* Kebab (Send/Download/Translate) — per explicit request
                (mockup's "Kebab Menu" callout), the same consolidated
                "More Options" trigger each page's own record-header cluster
                now renders (see those files' own header `actions` call
                sites) also belongs down here once it's THIS row, not the
                header, carrying the action cluster — i.e. once 2+ channels
                are open (`showActionCluster` true) and this is a live,
                non-draft session. Same `!isClosed && !isNewThread` gate as
                Consult/Transfer and Outcome right above — a closed session
                or a still-draft thread has nothing to send/download/
                translate yet either. 3 decorative, unwired items, same as
                every other copy of this menu in this app. */}
            {showKebabMenu && !isClosed && !isNewThread && (
              // Per explicit follow-up request ("also in the interaction
              // more options 3 dots add a tooltip that says more options
              // (like in the interactionNavItem)"): matches `ChannelRow`'s
              // own "More Options" tooltip on its kebab (channel-row.tsx),
              // including suppressing it while the dropdown is open via
              // `kebabMenuOpen`/`onOpenChange` below, same pattern.
              <Tooltip content="More Options" placement="bottom" disabled={kebabMenuOpen || controlsReadOnly}>
                <KebabMenuButton
                  ariaLabel="More Options"
                  align="right"
                  disabled={controlsReadOnly}
                  className={statusAndKebabBeforeOutcome ? "order-2" : undefined}
                  onOpenChange={setKebabMenuOpen}
                  items={
                    [
                      // Per explicit follow-up request (Advanced only — see
                      // `transferInKebabMenu`'s own doc comment above): folds
                      // the standalone Transfer icon (hidden above via that
                      // same prop) into this menu instead, leading its item
                      // list. Same unwired `onClick: () => {}` as every other
                      // row here.
                      ...(transferInKebabMenu
                        ? [
                            {
                              id: "consult-transfer",
                              label: "Consult / Transfer",
                              icon: <TransferIcon />,
                              onClick: () => {},
                            },
                          ]
                        : []),
                      {
                        id: "send-transcript",
                        label: "Send Transcript",
                        icon: <Send className="h-4 w-4" strokeWidth={1.5} />,
                        onClick: () => {},
                      },
                      {
                        id: "download-transcript",
                        label: "Download Transcript",
                        icon: <FileDown className="h-4 w-4" strokeWidth={1.5} />,
                        onClick: () => {},
                      },
                      {
                        id: "translate-messages",
                        label: "Translate Messages",
                        icon: <Languages className="h-4 w-4" strokeWidth={1.5} />,
                        onClick: () => {},
                      },
                    ] satisfies MenuEntry[]
                  }
                />
              </Tooltip>
            )}
            {/* Status tag — moved to the far right of the Consult/Transfer +
                Outcome cluster (was previously the leading element at the
                far left of this row) per explicit request. Same Popover/
                Menu/confirm-view behavior as before, just relocated —
                and, since a later request, extracted into its own
                `ChannelStatusTag` (above) so `AgentNextGenPage.tsx`'s
                record header can render the identical control once this
                row's own copy is hidden there (2.0 only).
                Per explicit follow-up request, also hidden for a brand-new
                outbound thread (`isNewThread`) — same reasoning as
                Consult/Transfer/Outcome/the kebab right above: a genuine,
                never-launched draft has no real status yet either, so this
                session row collapses down to ONLY the Delete Draft trash
                button (further below) once `isNewThread`, matching the
                mockup's 2+-channel draft state exactly. Previously this was
                the one piece of the cluster that stayed visible regardless
                of `isNewThread` — a real, confirmed bug fixed here
                alongside the header's own identical fix. */}
            {showStatus && !isNewThread && channelType !== "voice" && (
              <ChannelStatusTag
                status={session.status}
                menuOpen={statusMenuOpen}
                menuView={statusMenuView}
                onMenuOpenChange={onStatusMenuOpenChange}
                onSelectStatus={onSelectStatus}
                onConfirmClose={onConfirmClose}
                onCancelClose={onCancelClose}
                disabled={isClosed || controlsReadOnly}
                className={cn(outcomeAfterStatus && "order-1", statusAndKebabBeforeOutcome && "order-1")}
              />
            )}
            {/* Collapse icon — immediately right of the status tag, only for
                a session that actually reads "Closed" and only once
                `onToggleCollapsed` is passed (a caller that doesn't support
                collapsing closed sessions just omits it, same "renders for
                real regardless of a handler, or omit the slot entirely"
                shape the rest of this cluster already uses). Collapses this
                session's own message content — animated, owned by
                `InteractionTranscript` — while this whole row stays put;
                see `onToggleCollapsed`'s own doc comment above. */}
            {session.status === "Closed" && onToggleCollapsed && (
              <Tooltip content={collapsed ? "Expand session" : "Collapse session"} placement="bottom">
                <Button
                  variant="icon"
                  size="icon-sm"
                  aria-label={collapsed ? "Expand session" : "Collapse session"}
                  aria-expanded={!collapsed}
                  className={cn("text-lyra-fg-secondary", outcomeAfterStatus && "order-3", statusAndKebabBeforeOutcome && "order-4")}
                  onClick={onToggleCollapsed}
                >
                  {collapsed ? (
                    <ChevronsUpDown className="h-3.5 w-3.5" strokeWidth={1.5} />
                  ) : (
                    <ChevronsDownUp className="h-3.5 w-3.5" strokeWidth={1.5} />
                  )}
                </Button>
              </Tooltip>
            )}
            {/* Unassign & Dismiss — immediately right of the status tag (and,
                once a session reads "Closed," immediately right of the
                collapse/expand chevron just above instead, since that's the
                last thing still showing) — per explicit request. Same icon/
                action `ChannelTab`'s own kebab entry uses for this channel
                (see `onDismiss`'s own doc comment above for the exact
                scoping/wiring); only rendered at all for the current
                session, so there's no dead button on historical rows.
                Swaps to a plain `X` "Remove from Queue" icon once `isClosed`
                (still the exact same `onDismiss` handler underneath — see
                that branch just below) rather than disappearing entirely:
                per explicit follow-up request, a closed channel still needs
                a way to clear it out of the assignment queue, it just isn't
                "unassigning" anything live anymore. `UserX` (not a warning/
                alert glyph) — per
                explicit correction, this isn't a warning; it just removes
                the agent from the assignment, and sharing `TriangleAlert`
                with the SLA-severity tab icon made the two easy to
                confuse at a glance.
                Per later explicit follow-up request, restyled from a plain
                neutral icon button to a labeled outline-critical `Button`
                — same reasoning/exact same composed classes as the
                record-header's own now-matching copy of this button
                (Agent Workspace 2.0's icon-button cluster,
                AgentNextGenPage.tsx — see that call site's own doc comment
                for why no named `outline`+`critical` `Button` variant
                exists to reach for instead). `size="sm"` (24px) — matches
                this row's OTHER buttons (`icon-sm`, also 24px), unlike the
                header's own copy which sizes up to `md` (32px) to match
                that row's taller buttons instead.
                Per a later explicit follow-up request ("use a ghost button
                error variant"): `variant="outline"` (bordered) →
                `variant="ghost"` with the `border-lyra-status-critical-
                strong`/`hover:border-lyra-status-critical-strong` classes
                dropped — same critical-red icon color and
                `hover:bg-lyra-status-critical-subtle`/`active:bg-lyra-
                status-critical-medium` background states as before, just
                borderless now. Exactly the same `outline` → `ghost`
                treatment the record-header's own copy of this button
                already got (there's still no named `ghost`+`critical`
                `Button` variant, so this remains composed via `className`
                the same way — see that call site's own doc comment,
                AgentNextGenPage.tsx).
                For a brand-new outbound thread (`isNewThread`), this real
                button is swapped for a red trash-icon "Delete Draft"
                button instead — per explicit request, since closing a
                genuine, untouched draft (no message sent yet) actually
                deletes it outright rather than just dismissing a live
                assignment (see `onDismiss`'s own caller for the matching
                "skip Contact History" branch that pairs with this).
                Per a later explicit follow-up request ("make the delete
                icons in the session rows ghost button error variants that
                say 'Delete Draft'"): `variant="icon"` (icon-only, label
                only in the `title` tooltip) → `variant="ghost"` with the
                label rendered as visible text alongside the icon — same
                `text-lyra-status-critical-strong`/`hover:bg-lyra-status-
                critical-subtle`/`active:bg-lyra-status-critical-medium`
                "ghost + critical" color treatment the Unassign & Dismiss
                button just below already uses (there's still no named
                `ghost`+`critical` `Button` variant, so this stays composed
                via `className`). `size="sm"` (24px, labeled) instead of
                `size="icon-sm"` (also 24px, but icon-only) — the row has
                room for it since this button fully replaces the rest of
                the cluster for a draft thread (see this branch's own
                `isNewThread` gating above). `title` dropped since the
                label is visible text now, not just a tooltip. This ONE
                session-row copy only, per the request's own wording — the
                LeftNav card kebab and record-header tab kebab's matching
                `removeVariant="delete-draft"` fallback (channel-row.tsx)
                intentionally kept their original icon-only treatment,
                since neither was mentioned and both are much tighter
                spaces (a card row / a tab) than this session row has. */}
            {isNewThread
              ? onDismiss && !isClosed && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn("h-6 shrink-0 text-lyra-status-critical-strong hover:bg-lyra-status-critical-subtle hover:text-lyra-status-critical-strong active:bg-lyra-status-critical-medium", outcomeAfterStatus && "order-4")}
                    onClick={onDismiss}
                  >
                    <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                    Delete Draft
                  </Button>
                )
              : onDismiss && (
                  isClosed ? (
                    // Per explicit request: a CLOSED session has no live
                    // channel left for "Unassign & Dismiss" to apply to
                    // (that button stays gated `!isClosed` below), but the
                    // agent still needs a way to clear this assignment out
                    // of the queue once it's done — a plain close ("X")
                    // icon, immediately right of the collapse/expand
                    // chevron above, wired to this SAME `onDismiss` handler
                    // (`onDismissChannel`/`handleDismissInteraction` — see
                    // that prop's own doc comment). Same icon-only `ghost`+
                    // critical treatment as the open-session button just
                    // below, just a plain `X` glyph (not `UserX`) since
                    // there's no "unassign" framing left once the channel
                    // itself is already closed — this is just "remove it
                    // from my queue" at that point.
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      title="Remove from Queue"
                      className={cn("shrink-0 text-lyra-status-critical-strong hover:bg-lyra-status-critical-subtle hover:text-lyra-status-critical-strong active:bg-lyra-status-critical-medium", outcomeAfterStatus && "order-4", statusAndKebabBeforeOutcome && "order-5")}
                      onClick={onDismiss}
                    >
                      <X className="h-3.5 w-3.5" strokeWidth={1.5} />
                    </Button>
                  ) : (
                    // Per explicit follow-up request (applies wherever this
                    // button renders, across all 3 tiers — this component is
                    // shared): icon-only, no visible label, to take up less
                    // space in the row — dropped from `size="sm"` (24px,
                    // labeled) to `size="icon-sm"` (also 24px, so the row's
                    // own height/alignment is unaffected) with the label
                    // moved into `title`, which `Button` itself auto-wraps in
                    // a Tooltip + sets as `aria-label` for any `icon-*` size
                    // (see that prop's own doc comment, button.tsx) — same
                    // pattern the `isNewThread` close button just above
                    // already uses (`title="Close"`).
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      title="Unassign & Dismiss"
                      className={cn("shrink-0 text-lyra-status-critical-strong hover:bg-lyra-status-critical-subtle hover:text-lyra-status-critical-strong active:bg-lyra-status-critical-medium", outcomeAfterStatus && "order-4", statusAndKebabBeforeOutcome && "order-5")}
                      onClick={onDismiss}
                    >
                      <UserX className="h-3.5 w-3.5" strokeWidth={1.5} />
                    </Button>
                  )
                )}
            {/* "Open Details Panel" — new icon button, immediately right of
                Unassign & Dismiss/Remove from Queue/Delete Draft (per
                explicit request). Per further explicit follow-up request
                ("this should say 'Open Details Panel' and just open/close
                - the panel not list the options"): no more menu — a plain
                toggle of the caller's own Details panel open/closed state
                (`onToggleDetailsPanel`'s own doc comment above). Rendered
                for every row `onToggleDetailsPanel` is passed for, not
                just the current session — same reasoning as before, this
                button has no session-specific opinion to withhold from a
                closed/past session. Per explicit follow-up request ("hide
                the toggle icon button when the session details are
                open"): also gated on `!detailsPanelOpen` now — see that
                prop's own doc comment above for the full "why". */}
            {detailsPanelButton &&
              (detailsPanelPreviewContent ? (
                // Same `Popover` shape `CustomerInfoHoverPreview`'s own
                // former call site used (bottom-end anchored, no arrow, no
                // padding of its own since the preview content brings its
                // own card chrome) — open/close timing is entirely the
                // caller's (`detailsPanelPreviewOpen`), this just renders
                // it. The two auto-focus preventions and the
                // `data-radix-popper-content-wrapper` outside-interaction
                // guard match that former call site exactly, so a nested
                // overflow menu inside the preview content doesn't get
                // treated as an "outside" click that closes this Popover.
                <Popover
                  open={detailsPanelPreviewOpen}
                  placement="bottom"
                  align="end"
                  showArrow={false}
                  bodyPadding={false}
                  className="border-0 bg-transparent p-0 shadow-none"
                  onOpenAutoFocus={(e: Event) => e.preventDefault()}
                  onCloseAutoFocus={(e: Event) => e.preventDefault()}
                  onInteractOutside={(e: Event) => {
                    if ((e.target as Element)?.closest?.("[data-radix-popper-content-wrapper]")) {
                      e.preventDefault();
                    }
                  }}
                  content={detailsPanelPreviewContent}
                >
                  {detailsPanelButton}
                </Popover>
              ) : (
                detailsPanelButton
              ))}
          </div>
          )}
        </div>
      </div>
      {!hideFade && (
        <div
          className="pointer-events-none absolute inset-x-0 -bottom-8 h-8 bg-gradient-to-b from-lyra-bg-surface-base to-transparent"
          aria-hidden="true"
        />
      )}
    </div>
  );
  // See `portalTarget`'s own doc comment above — every other call site
  // (no target passed) renders `content` exactly where it always has.
  return portalTarget ? createPortal(content, portalTarget) : content;
}

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
  contactId,
  channelAddressLabel,
  skillLabel,
  isFreshLaunch,
  contactOverview: contactOverviewIn,
  customerContextOverview: customerContextOverviewIn,
  hideAiActions = false,
  showCustomerContextProfile,
  showCustomerContextSnapshot,
  showCustomerContextNextBestAction,
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
  autosummaryBlue = false,
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
  onCurrentSessionChange,
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
   * When set, renders the newer `CustomerContextOverview` block (Customer
   * Profile / Customer Snapshot / Next Best Action — see that component's
   * own doc comment, contact-overview.tsx) at the SAME two spots
   * `contactOverview` would otherwise use, INSTEAD of `ContactOverview` —
   * this takes priority over `contactOverview` whenever both happen to be
   * set. Per explicit request, only AgentNextGenPage.tsx and
   * AgentWorkspace2WithDeskPage.tsx pass this ("Phase 1"/"Phase 2");
   * AgentWorkspaceAdvancedPage.tsx now passes it too (its own explicit
   * follow-up request to mirror Phase 1's Customer Context Overview
   * functionality — see that page's own call site) — this doc comment's
   * "still passes plain `contactOverview`" is stale as of that change.
   * Same "caller resolves the content, this component just renders it"
   * division of labor `contactOverview` itself already follows.
   */
  customerContextOverview?: CustomerContextOverviewInfo;
  /**
   * Overrides the "Customer Profile" container's own default visibility
   * inside `customerContextOverview`'s block (normally derived from
   * whether `customerContextOverview.customerCard` is set — see
   * `renderContactOverviewBlock`'s own `showCustomerProfile` line below)
   * — `false` force-hides it regardless of `customerCard`. Per explicit
   * request ("hide the customer profile and contact snapshot from the
   * main container and just display the next best action"):
   * AgentWorkspaceAdvancedPage.tsx passes `false` at its own main-column
   * `<InteractionTranscript>` call site so only "Next Best Action" shows
   * there, while its own "Details" side panel tab still shows the full
   * Customer Profile/Contact Snapshot cards (a separate, un-gated
   * `CustomerContextOverview`/`DetailsPanelAccordions` render, unaffected
   * by this prop). `undefined` (default) keeps the existing derived
   * behavior for every other consumer/call site.
   */
  showCustomerContextProfile?: boolean;
  /**
   * Same idea as `showCustomerContextProfile` just above, for the
   * "Contact Snapshot" container — see that prop's own doc comment for
   * the full "why". `undefined` (default) shows it, matching
   * `CustomerContextOverview`'s own `showContactSnapshot` default.
   */
  showCustomerContextSnapshot?: boolean;
  /**
   * Same idea as `showCustomerContextProfile`/`showCustomerContextSnapshot`
   * above, for the "Next Best Action" container. Per explicit follow-up
   * request ("replace the next best action in all new assignments with
   * autosummary — tie the autosummary to the contact so it is not random
   * info"): AgentWorkspaceAdvancedPage.tsx's own main-column
   * `<InteractionTranscript>` call site now passes `false` here (alongside
   * flipping `showCustomerContextSnapshot` back to `true`) so a fresh
   * assignment's main transcript column shows the real, per-contact
   * "Autosummary" recap (`customerContextOverview.snapshot` —  the exact
   * same contact-specific bullet list already shown in the "Details" side
   * panel, not placeholder/random copy) instead of the generic
   * "Next Best Action" suggestion. `undefined` (default) keeps the
   * existing behavior (shown, matching `CustomerContextOverview`'s own
   * `showNextBestAction = true` default) for every other consumer/call
   * site.
   */
  showCustomerContextNextBestAction?: boolean;
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
  /** Blue (info) Autosummary header instead of purple — used for the Marcus Webb and Lucas Thomas assignments. */
  autosummaryBlue?: boolean;
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
  onViewSessionDetails?: (session: Contact) => void;
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
  /** Fires whenever the CURRENT session (`lastSessionId` — same one
   *  `onViewSessionDetails` reports on click) is computed, independent of
   *  any click — per explicit bug report, voice's "Session Details" panel
   *  showed a bare "Select 'View Details' on a session..." placeholder if
   *  the agent switched straight to its "Details" tab without ever
   *  clicking "View Details" on a session row first, even though there's
   *  always exactly one real current session to show. The caller (each
   *  tier page) stores whatever this reports as a fallback session for
   *  that tab, so it has something real to show even with no click yet.
   *  Omit for a caller with no such fallback to maintain (nothing renders
   *  differently here either way). */
  onCurrentSessionChange?: (session: Contact) => void;
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
  const showSessionStatus = showSessionStatusProp ?? caseStatusCapable;
  const contactOverview = contactOverviewIn;
  const customerContextOverview = customerContextOverviewIn;
  const liveMessages = liveMessagesIn;
  // A freshly-launched interaction (see `isFreshLaunch`'s own doc comment)
  // shows just a single synthesized "Session Details" separator (today's
  // date, this Thread's own base contactId/skill, status "Open") in place
  // of the fixed `TRANSCRIPT_SESSIONS`/`_VOICE`/`_EMAIL` mock log — a
  // brand-new interaction genuinely has no history yet AND hasn't been
  // worked/resolved yet either.
  //
  // Originally only SMS got this (per an earlier, narrower request); Chat/
  // WhatsApp fell through to the shared mock log even when freshly
  // launched (the "brand-new WhatsApp shows a full, pre-existing
  // conversation" bug reported from a screenshot of a New Outbound
  // WhatsApp launch), so this was widened to cover all three text
  // channels. Voice/Email were deliberately left OUT of that widening at
  // the time — their own fixed mock session has no message log to wrongly
  // show in the first place (`messages: []` either way), so the "fake
  // history" bug this fix targeted genuinely didn't apply to them — but
  // that same fixed mock's `status` field is hardcoded `"Resolved"` (see
  // `TRANSCRIPT_SESSIONS_VOICE`/`_EMAIL`'s own doc comments), which is
  // exactly wrong for a call/email that just started: per explicit bug
  // report ("new interactions should have an 'open' status to start"), a
  // brand-new Voice/Email thread was showing "Resolved" in its own
  // Session Details pill before the agent had done anything at all. Voice/
  // Email now go through this same synthesized-session branch for that
  // reason — the "no history" framing happens to apply to them for free
  // (their synthesized session's `messages` is `[]`, identical to what
  // their static mock already used), and the status/date/time now
  // correctly reflect "just started" instead of a stale, already-resolved
  // mock call from months ago. `liveMessages` (real, sent-this-visit
  // messages) renders in its own trailing block right after whichever of
  // the two this resolves to — see the render return below.
  //
  // Computed up here, before any hooks below, purely so `sessionsToRender`
  // (specifically its LAST entry's id) is available to `getSessionStatus`/
  // `selectSessionStatus`/`handleConfirmCloseSession` further down without
  // reordering those — this is a plain computation from props, not a hook
  // itself, so moving it earlier doesn't affect hook call order/count.
  const isTextChannel = channelType === "chat" || channelType === "sms" || channelType === "whatsapp";
  const now = new Date();
  // The synthesized fresh session's own "Channel" field (Session Details'
  // Contact ID/Date/.../Channel/Skill row) should read as whichever
  // channel was actually launched, not a hardcoded "SMS" now that this
  // covers every channel type, not just the three text ones.
  const freshSessionChannelLabel =
    channelType === "whatsapp"
      ? "WhatsApp"
      : channelType === "chat"
      ? "Chat"
      : channelType === "sms"
      ? "SMS"
      : channelType === "voice"
      ? "Voice"
      : "Email";
  // Same per-channel-family fingerprint the static `TRANSCRIPT_SESSIONS_VOICE`/
  // `_EMAIL` mocks already use for a RESUMED call/email (see each one's own
  // doc comment) — reused here so a freshly-launched one's synthesized
  // session shows the same plausible device metadata instead of falling
  // back to chat's fingerprint just because it's built in this shared
  // branch now.
  const freshSessionFingerprint =
    channelType === "voice"
      ? TRANSCRIPT_SESSION_FINGERPRINT_VOICE
      : channelType === "email"
      ? TRANSCRIPT_SESSION_FINGERPRINT_EMAIL
      : TRANSCRIPT_SESSION_FINGERPRINT;
  // Voice/Email's own (non-fresh) session arrays (see `TRANSCRIPT_SESSIONS_VOICE`/
  // `TRANSCRIPT_SESSIONS_EMAIL`'s own doc comments) rather than falling
  // through to chat's `TRANSCRIPT_SESSIONS` — every channel type shows
  // session info, but a call or an email shouldn't be mislabeled "SMS" in
  // its own Session Details panel just because it fell into the same
  // default branch.
  const baseSessionsToRender: Contact[] = isFreshLaunch
    ? [
        {
          id: "session-fresh",
          contactId,
          addressLabel: channelAddressLabel,
          date: now.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" }),
          startTime: now.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }),
          endTime: "—",
          channel: freshSessionChannelLabel,
          skill: skillLabel ?? "—",
          agent: `${CURRENT_AGENT_FIRST_NAME} ${CURRENT_AGENT_LAST_NAME}`,
          status: "Open",
          fingerprint: freshSessionFingerprint,
          messages: [],
        },
      ]
    : channelType === "voice"
    ? TRANSCRIPT_SESSIONS_VOICE
    : channelType === "email"
    ? TRANSCRIPT_SESSIONS_EMAIL
    : hideMockFollowUpMessages
    ? TRANSCRIPT_SESSIONS.map((sess) => (sess.id === "session-2" ? { ...sess, messages: [] } : sess))
    : TRANSCRIPT_SESSIONS;
  // One more synthetic, empty "Session Details" separator per reopen — see
  // `reopenedContacts`' own doc comment above. Same synthetic shape as
  // `session-fresh` above, just built from the reopen's own captured
  // date/time (`reopenedContacts` entries) instead of "now" and keyed by
  // that entry's own id rather than the fixed `"session-fresh"` one, so
  // several reopens on the same channel each render as their own distinct
  // row instead of colliding on id. Text channels only — voice/email have
  // no multi-session "reopen" concept to extend here (their
  // `reopenedContacts` prop is always `undefined` in practice, but
  // `isTextChannel` guards this regardless), unlike `baseSessionsToRender`
  // above, which now covers every channel type for the "fresh launch"
  // case.
  const reopenedSessionsToRender: Contact[] = isTextChannel
    ? (reopenedContacts ?? []).map((entry) => ({
        id: entry.id,
        contactId: entry.contactId,
        // Same live channel, just reopened — reuses the one active
        // `channelAddressLabel` rather than needing its own per-reopen
        // value (`reopenedContacts` entries carry no address of their
        // own; see this field's own doc comment on `Contact`).
        addressLabel: channelAddressLabel,
        date: entry.date,
        startTime: entry.startTime,
        endTime: "—",
        channel: freshSessionChannelLabel,
        skill: skillLabel ?? "—",
        agent: `${CURRENT_AGENT_FIRST_NAME} ${CURRENT_AGENT_LAST_NAME}`,
        status: "Open",
        fingerprint: TRANSCRIPT_SESSION_FINGERPRINT,
        messages: [],
      }))
    : [];
  const sessionsToRender: Contact[] = [...baseSessionsToRender, ...reopenedSessionsToRender];
  // The "current" session for status purposes — see `currentStatus`/
  // `onCurrentStatusChange`'s own doc comments above. Now always the most
  // RECENT reopen (if any) rather than always `baseSessionsToRender`'s own
  // last entry — reopening should hand "current" over to the brand-new
  // session, not leave it pointed at the old closed one.
  const lastSessionId = sessionsToRender[sessionsToRender.length - 1]?.id;

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
  const renderContactOverviewBlock = () => (
    <AiActionCollapse hidden={hideAiActions}>{renderContactOverviewBlockInner()}</AiActionCollapse>
  );
  const renderContactOverviewBlockInner = () =>
    customerContextOverview ? (
      <CustomerContextOverview
        customerName={displayName}
        customerCard={customerContextOverview.customerCard}
        snapshot={customerContextOverview.snapshot}
        onSnapshotLink={onSnapshotLink}
        autosummaryBlue={autosummaryBlue}
        nextBestAction={customerContextOverview.nextBestAction}
        nextBestActionContent={customerContextOverview.nextBestActionContent}
        nextBestActionBare={customerContextOverview.nextBestActionBare}
        // Per explicit request ("put the customer summary content inside
        // the customer profile accordion") — see `detailedSummary`'s own
        // doc comment (lyra-ui/contact-overview.tsx) for what this renders.
        detailedSummary={customerContextOverview.detailedSummary}
        // Per explicit follow-up request ("if a new call is made or the
        // customer does not have any information, do not display the
        // customer profile"): `customerCard` is only ever unset for
        // exactly that case (`buildCustomerContextOverviewInfo`'s own
        // `!isKnownCustomer` branch, agent-next-gen-shared-utils.ts) — so
        // its presence doubles as the "is there anything useful to show
        // here" signal, no separate flag needed from callers.
        showCustomerProfile={showCustomerContextProfile ?? !!customerContextOverview.customerCard}
        // See `showCustomerContextSnapshot`'s own doc comment above —
        // `undefined` here falls through to `CustomerContextOverview`'s
        // own `showContactSnapshot = true` default.
        showContactSnapshot={showCustomerContextSnapshot}
        // See `showCustomerContextNextBestAction`'s own doc comment above —
        // `undefined` here falls through to `CustomerContextOverview`'s
        // own `showNextBestAction = true` default.
        showNextBestAction={showCustomerContextNextBestAction}
        onViewCustomerInfo={onViewCustomerInfo}
        onViewInteractionHistory={onViewInteractionHistory}
      />
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
  const getSessionStatus = (session: Contact) =>
    session.id === lastSessionId ? currentStatus ?? session.status : "Closed";

  // Reports the current session to `onCurrentSessionChange` (see that
  // prop's own doc comment) any time it actually changes — keyed on
  // `lastSessionId`/`currentStatus` alone (both plain primitives) rather
  // than on `sessionsToRender` itself (a new array reference every render)
  // so this can't re-fire on every render and loop with a caller that
  // stores the result in its own state.
  useEffect(() => {
    const current = sessionsToRender.find((session) => session.id === lastSessionId);
    if (current) {
      onCurrentSessionChange?.({ ...current, status: getSessionStatus(current) });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastSessionId, currentStatus]);

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
    <div className="relative flex-1 min-h-0 min-w-0">
      <div
        ref={scrollContainerRef}
        className="h-full overflow-y-auto"
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
            const sessionWithCurrentStatus: Contact = {
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
                  value={collapsedSessionIds.has(session.id) ? "" : session.id}
                  onValueChange={() => {}}
                >
                <AccordionHeadlessItem value={session.id} className="border-none">
                <AccordionHeadlessContent>
                <div
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
                    "w-full max-w-[768px] mx-auto px-6",
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
                  renderContactOverviewBlock()}
                {messages.length > 0 && (
                  <div className="flex min-w-0 flex-col gap-5 py-4">
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
                  <div className="flex items-center justify-center py-12">
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
                    const rendered = message.instruction ? (
                      <InstructionInterstitial
                        key={message.id}
                        id={message.id}
                        instruction={message.instruction}
                        timestamp={message.timestamp}
                        onOpen={(link) => onSnapshotLink?.(link)}
                        active={activeSnapshotLink === message.instruction.link}
                      />
) : message.wrapUp ? (
                      <WrapUpAccordion key={message.id} message={message} onComplete={onWrapUpComplete} />
                    ) : message.summary ? (
                      <div key={message.id} className="flex flex-col gap-5">
                        {overviewBeforeApproval && session.id === lastSessionId && liveMessages.find((m) => !!m.summary)?.id === message.id && renderContactOverviewBlock()}
                        <ApprovalSummaryAccordion message={message} onDecide={onApprovalDecision} onCallRequest={onApprovalCallRequest} onLink={onSnapshotLink} onSuggestionAsk={onApprovalSuggestionAsk} takenOver={approvalTakenOver} />
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
                    const isAiAction = !!(message.instruction || message.wrapUp || message.summary || message.event);
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
                        <div className="flex flex-col gap-5 py-4">
                          {existingLiveMessages.map(renderLiveMessage)}
                        </div>
                      )}
                      {isNonFreshOverviewSession && renderContactOverviewBlock()}
                      {(newLiveMessages.length > 0 || showTypingIndicator || showAiTypingIndicator) && (
                        <div className="flex flex-col gap-5 py-4">
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
          {trailingContent && (
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
/** At most this many Copilot suggestion chips show at once. */
const COPILOT_CHIPS_MAX = 3;
/** The row's `gap-2`. */
const COPILOT_CHIPS_GAP_PX = 8;

/**
 * Copilot suggestion chips on one line that never wraps: as many as fit
 * beside the refresh button (up to 3, at least 1), measured from the row's
 * own width with a ResizeObserver (not a breakpoint), so the same row works
 * inline and in the docked 425px panel. The refresh button is always there
 * and rotates to the next suggestion(s). An invisible copy of every chip
 * gives their natural widths.
 */
function CopilotChipRow({
  suggestions,
  focusable,
  onActivate,
}: {
  suggestions: string[];
  focusable: boolean;
  onActivate: (suggestion: string) => void;
}) {
  const rowRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const refreshRef = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState(0);
  const [count, setCount] = useState(Math.min(COPILOT_CHIPS_MAX, suggestions.length));
  const n = suggestions.length;
  const start = n > 0 ? offset % n : 0;

  useLayoutEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    const measure = () => {
      const available =
        row.getBoundingClientRect().width -
        (refreshRef.current?.getBoundingClientRect().width ?? 0) -
        COPILOT_CHIPS_GAP_PX;
      const widths = [...(measureRef.current?.children ?? [])].map((el) => el.getBoundingClientRect().width);
      let used = 0;
      let fit = 0;
      for (let i = 0; i < Math.min(COPILOT_CHIPS_MAX, n); i += 1) {
        const w = widths[(start + i) % n] ?? 0;
        const next = used + (fit > 0 ? COPILOT_CHIPS_GAP_PX : 0) + w;
        if (next > available) break;
        used = next;
        fit += 1;
      }
      setCount(Math.max(1, fit));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(row);
    return () => ro.disconnect();
    // Keyed on the suggestions' text, not the array (a new one each render).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n, start, suggestions.join("\n")]);

  if (n === 0) return null;
  const visible = Array.from({ length: Math.min(count, n) }, (_, i) => suggestions[(start + i) % n]);

  return (
    <div ref={rowRef} data-slot="copilot-chips" className="relative flex min-w-0 flex-1 flex-nowrap items-center gap-2 overflow-hidden">
      {visible.map((suggestion) => (
        <Tag
          key={suggestion}
          label={suggestion}
          variant="purple"
          icon={<Sparkles className="h-3 w-3" strokeWidth={1.5} aria-hidden="true" />}
          shape="pill"
          role="button"
          tabIndex={focusable ? 0 : -1}
          className="shrink-0 cursor-pointer"
          onClick={() => onActivate(suggestion)}
          onKeyDown={(e: React.KeyboardEvent<HTMLSpanElement>) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onActivate(suggestion);
            }
          }}
        />
      ))}
      <div ref={refreshRef} data-slot="copilot-chips-refresh" className="shrink-0">
        <ActionIconButton
          size="xs"
          title="More suggestions"
          tabIndex={focusable ? 0 : -1}
          onClick={() => setOffset((o) => (o + Math.max(1, Math.min(count, n - 1))) % n)}
        >
          <RefreshCw className="h-3.5 w-3.5" strokeWidth={1.5} />
        </ActionIconButton>
      </div>
      {/* Natural widths of every chip, for the fit above. */}
      <div ref={measureRef} aria-hidden="true" className="pointer-events-none invisible absolute left-0 top-0 flex gap-2 whitespace-nowrap">
        {suggestions.map((suggestion) => (
          <Tag
            key={suggestion}
            label={suggestion}
            variant="purple"
            icon={<Sparkles className="h-3 w-3" strokeWidth={1.5} aria-hidden="true" />}
            shape="pill"
            data-chip-measure=""
            className="shrink-0"
          />
        ))}
      </div>
    </div>
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
}: {
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
      if (target instanceof Element && target.closest("[data-radix-popper-content-wrapper]")) return;
      closeQuickReplyMenu();
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [quickReplyOpen]);

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
    if (!canSend) return;
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
  const renderCopilotChips = (focusable: boolean) =>
    activeCopilotSuggestions.length > 0 ? (
      <CopilotChipRow suggestions={activeCopilotSuggestions} focusable={focusable} onActivate={activateCopilotSuggestion} />
    ) : null;

  // Docked (AI in the Contact Details panel): stacked for the panel's
  // width — chips, then the input (text on top, +/mic beneath: `AIInput`'s
  // own multi-line layout), then Takeover full width.
  const dockedCopilot = copilotDock?.mount
    ? createPortal(
        <div data-slot="copilot-composer" className="flex w-full flex-col gap-3">
          {renderCopilotChips(true)}
          <AIInput
            value={copilotQuestion}
            onChange={setCopilotQuestion}
            onSubmit={submitCopilot}
            placeholder="Ask Copilot about this customer or conversation..."
            helperText=""
            className="w-full"
          />
          {copilotOnly && onTakeover && (
            <Button
              variant="destructive"
              size="md"
              className="w-full"
              onClick={onTakeover}
              disabled={takeoverDisabled}
              title={takeoverDisabled ? takeoverDisabledReason : undefined}
            >
              {takeoverLabel}
            </Button>
          )}
        </div>,
        copilotDock.mount,
      )
    : null;
  // Copilot-only and docked: nothing stays inline.
  if (copilotDocked && copilotOnly) return dockedCopilot;

  return (
    <div className="relative shrink-0 bg-lyra-bg-surface-base px-6 py-4">
      {dockedCopilot}
      {/* Soft fade instead of a hard border-top — reads as the transcript
          scrolling *under* the composer rather than stopping at a line.
          Positioned outside this div's own box (negative top), so it
          overlays the last ~32px of the scrollable transcript sitting
          directly above it (that sibling isn't `overflow-hidden` on itself
          from the outside, only its own internal scroll is clipped, so an
          absolutely-positioned overlay from a neighboring box can still
          paint over it). */}
      <div
        className="pointer-events-none absolute inset-x-0 -top-8 h-8 bg-gradient-to-b from-transparent to-lyra-bg-surface-base"
        aria-hidden="true"
      />
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
          <div ref={quickReplyContainerRef} className="mb-2">
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
          </div>
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
        {/* Both panes share one grid cell so the area keeps the taller (chat) height on either tab. */}
        <div className="grid">
        {!copilotDocked && (
        <div
          ref={copilotPaneRef}
          className={`col-start-1 row-start-1 ${composerTab === "copilot" ? "animate-in fade-in-0 duration-200" : "invisible pointer-events-none"}`}
          aria-hidden={composerTab !== "copilot"}
        >
            <AIInput
              value={copilotQuestion}
              onChange={setCopilotQuestion}
              onSubmit={submitCopilot}
              placeholder="Ask Copilot about this customer or conversation..."
              helperText=""
              className="w-full"
            />
            <div className="mt-3 flex items-start justify-between gap-3">
            {renderCopilotChips(composerTab === "copilot") ?? <span />}
            {copilotOnly && onTakeover && (
              <Button variant="destructive" size="md" className="shrink-0" onClick={onTakeover} disabled={takeoverDisabled} title={takeoverDisabled ? takeoverDisabledReason : undefined} tabIndex={composerTab === "copilot" ? 0 : -1}>
                {takeoverLabel}
              </Button>
            )}
            </div>
        </div>
        )}
        <div className={`col-start-1 row-start-1 ${composerTab === "chat" ? "" : "invisible pointer-events-none"}`} aria-hidden={composerTab !== "chat"}>
        <Textarea
          ref={textareaRef}
          placeholder="Type a message... or / for quick replies"
          rows={3}
          value={message}
          onChange={handleMessageChange}
          onKeyDown={handleComposerKeyDown}
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
            <ActionIconButton size="sm" title="Quick replies" onClick={openQuickReplyMenuAtCaret}>
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
              disabled={!canSend}
              onClick={handleSend}
            >
              <Send className="h-4 w-4" strokeWidth={1.5} />
              Send
            </Button>
            <Button
              variant="default"
              size="icon-lg"
              className="rounded-l-none border-l border-white/25"
              disabled={!canSend}
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