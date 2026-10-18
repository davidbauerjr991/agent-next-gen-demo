// The transcript's view-model types (P-EXTRACT: split out of
// agent-next-gen-transcript.tsx, which re-exports them).
import type { TagVariant } from "@nicecxone/lyra-ui";
import type { SaveAddressOffer } from "@/contact-handling/SaveAddressCard";

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
  /** Renders the clickable instruction row (opens a side panel via `onSnapshotLink`), showing "AI agent is
   *  performing this now…" until `performedAt` (epoch ms; absent: already performed). */
  instruction?: { title: string; by: string; link: string; performedAt?: number };
  /** Renders a "Wrap up" accordion (same shell as the approval request, success-subtle header) with a summary and a completion button. */
  wrapUp?: { title: string; summary: string; disposition: string; buttonLabel: string; exiting?: boolean };
  /** Renders the "Add {address} as … for {customer}?" card (k8 8): a thread started on an address not on the record. */
  saveAddress?: SaveAddressOffer;
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

export type ApprovalDecisionDef = NonNullable<TranscriptApprovalSummary["decisions"]>[number];

/** Client/device metadata captured off a session's own originating client
 *  (OS/Browser/Language/Device Type/Application Type) — shown as a single
 *  "chat fingerprint" line in that session's `TranscriptSessionDetails`
 *  footer (per explicit request/reference screenshot). Optional on
 *  `TranscriptSession`; every channel now populates one (see the three
 *  `TRANSCRIPT_SESSION_FINGERPRINT*` consts, transcript-fixtures.ts —
 *  chat/SMS/WhatsApp share one shape, Voice and Email each get their own
 *  since "Browser"/"Application Type" mean something different for a WebRTC
 *  call or a webmail client than for a chat widget), so the footer now
 *  renders for every channel type rather than only text channels — per an
 *  explicit follow-up request after the original "text channels only"
 *  scoping. */
export interface TranscriptSessionFingerprint {
  os: string;
  browser: string;
  language: string;
  deviceType: string;
  applicationType: string;
}

/* Each `TranscriptSession` (was the legacy `Contact`, renamed in P-EXTRACT:
   it's a session view model, not a contact record) is one contact record
   within the interaction — the reference screenshot's
   "# CTX-20250722-08841 · July 22, 2025 ⌄" separator plus the "Session
   Details" panel it expands to (Contact ID / Date / Start / End / Channel /
   Skill / Agent / Status). A single interaction can span more than one
   session (a callback, a follow-up message thread days later, etc.) —
   grouping `TranscriptMessage[]` under a session rather than one flat list
   is what lets the transcript render a separator between each and let every
   one collapse/expand independently. Two mock sessions
   (`TRANSCRIPT_SESSIONS`: a closed first contact, then a shorter follow-up)
   are enough to demonstrate the separator-per-session + sticky-stacking
   behavior; still a UI prototype, not real per-interaction session data.
   Session info (this separator + its Session Details panel) is shown for
   every channel type — Voice/Email get their own sibling arrays
   (`TRANSCRIPT_SESSIONS_VOICE`/`TRANSCRIPT_SESSIONS_EMAIL`), each with an
   empty `messages: []` since neither channel has designed transcript
   content yet (a call recording/summary UI, an email thread UI) — the
   session separator and its expandable details still apply to a call or an
   email the same as they do to a chat, it's only the message-by-message
   body underneath that's still a placeholder. See `InteractionTranscript`'s
   per-session render for where that placeholder actually shows. */
export interface TranscriptSession {
  id: string;
  contactId: string;
  /** Per explicit request ("display the number in the session row instead
   *  of the contact ID — display email/whatsapp handle/etc. for phase
   *  2"): the human-readable reach address for this session (phone number/
   *  email address/WhatsApp handle — same generic meaning as `Thread.
   *  addressLabel`, which is exactly where this comes from for the live
   *  session; see `InteractionTranscript`'s own `channelAddressLabel` prop
   *  doc comment). Undefined for every static historical mock session
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
