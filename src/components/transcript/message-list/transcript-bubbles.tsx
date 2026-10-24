// The transcript's message rows: chat bubbles, voice's plain lines and the typing indicator
// (P-EXTRACT: split out of agent-next-gen-transcript.tsx).
import { Avatar, ChatMessage } from "@nicecxone/lyra-ui";
import { Bot } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TranscriptMessage, TranscriptTag } from "../transcript-types";

// Quick-add options offered from a message's hover "Tags" action — matches
// the app's real tag vocabulary (Complain/Help/Praise/Share/Billing), not
// an invented set, so a picked tag reads the same as the one seeded on m4.
// "Billing" (topic label, not sentiment) reuses the same neutral `default`
// variant "Share" already established for a non-sentiment tag. Deliberately
// not purple/teal/pink — CONTRIBUTING.md reserves those three Tag variants
// for channel-type coloring specifically.
// Expanded to 25 (per explicit request, to actually exercise TagPicker's
// scrollable checkbox list rather than a 5-row set that never needed to
// scroll) — a realistic support-conversation tag vocabulary, not filler:
// sentiment/feedback tags (Complain/Praise/...), the common request
// categories an agent would tag a message with (Billing/Refund/
// Cancellation/...), and a few urgency/risk markers (Escalation/Fraud
// Alert/Churn Risk). Still only `default`/`success`/`warning`/`critical`/
// `info`/`neutral` variants — see this file's own note above reserving
// `purple`/`teal`/`pink` for channel-type coloring.
const QUICK_TAG_OPTIONS:Omit<TranscriptTag, "id">[] = [
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
   `InteractionTranscript` so it can be looped once per session
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
   existing call site needed zero changes. */
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
 *  `TranscriptMessageBubble` only for voice channels (see
 *  `InteractionTranscript`'s `renderPlainLine`/`renderBubble` selection) —
 *  chat/sms/whatsapp keep the bubble layout exactly as before. */
export function TranscriptPlainLine({ name, timestamp, text }: { name: string; timestamp: string; text: string }) {
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
export function TypingIndicator({
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
