// The transcript's fixed option lists and mock session data (P-EXTRACT: split
// out of agent-next-gen-transcript.tsx, which re-exports them).
import type { DispositionOption, TagPickerOption, TagVariant } from "@nicecxone/lyra-ui";
import type { TranscriptSession, TranscriptSessionFingerprint } from "./transcript-types";

// Status → `Tag` variant for `TranscriptSessionSeparator`'s pill — a small,
// local map rather than reusing `CUSTOMER_LATEST_INTERACTION_STATUS_POOL`
// (Customer Information panel's own status pool): that one's a random-draw
// pool for a different feature's synthesized data and doesn't even include
// "Open" (every draw there is Resolved/Escalated/Pending), so it isn't
// actually the same vocabulary. `Tag` (pill shape), not `Badge` — per
// explicit request, matching the same pill-shaped tag treatment used
// elsewhere in this transcript (e.g. the applied message tags just above
// the composer). Falls back to "neutral" for any future
// `TranscriptSession.status` value not listed here, rather than throwing.
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

export const TRANSCRIPT_SESSIONS: TranscriptSession[] = [
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

// Voice's own session — see `TranscriptSession`'s own doc comment
// (transcript-types.ts) for why `messages` is empty here. One
// closed/"Resolved" session is enough to show the separator + Session
// Details for a call, same as chat's own mock log demonstrates it for
// SMS/WhatsApp.
export const TRANSCRIPT_SESSIONS_VOICE: TranscriptSession[] = [
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
export const TRANSCRIPT_SESSIONS_EMAIL: TranscriptSession[] = [
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
