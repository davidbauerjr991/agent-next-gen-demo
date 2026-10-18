// The composer's quick replies (P-EXTRACT: split out of agent-next-gen-transcript.tsx, unchanged).
import type { QuickReplyField } from "@nicecxone/lyra-ui";
import { quickReplyFieldDisplayValue } from "@/components/agent-next-gen-shared-utils";

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

/** See `InteractionComposer`'s doc comment for the quick-reply mechanics. */
export const QUICK_REPLY_TRIGGER_CHAR = "/";
export const QUICK_REPLY_TRIGGER_PATTERN = /\/(\w*)$/;
