// InteractionsListView — top-level "Interactions" desk tab (to the right of
// WEM, see `DESK_TAB_LABELS`/`deskTabOrder` in AgentNextGenPage.tsx). A
// full Search/Filter/Columns/Refresh/Reset table over a flat, synthetic
// interaction-history dataset — built from a reference screenshot (search
// bar, Refresh/Reset, a "Columns" show/hide picker, a Channel/Status/Skill/
// Inbox Assignee/Owner Assignee/Tag/Create Date filter set, a sortable
// table, and "N–M of T" pagination).
//
// Filters use the SAME "+ Filter" add-menu → `FilterChip` pattern the
// Customers tab already established (`CustomersListView`, agent-next-gen-
// customers-table.tsx — `addedFilterKeys`/`filterValues`/`TableToolbar`'s
// own automatic `filterDefs` rendering), per explicit request, rather than
// this table's own first pass (a single always-open "Filter Options" panel
// with every field shown at once) — see `INTERACTION_HISTORY_FILTER_FIELD_
// DEFS`/`InteractionsListView`'s own filter state below for exactly how
// that's wired here. Create Date is the one field that doesn't fit that
// generic string[]-values shape (a date RANGE, not a set of picked values)
// — it's still toggled on/off from that same add-menu, but renders as its
// own `DateRangeFilterChip` (lyra-ui's shared Today/Yesterday/Last 7 days/
// Custom date-range control — already used identically by the Contact
// History card and the Performance/Productivity cards' own date filters)
// instead of going through `filterDefs`.
//
// Reuses `INTERACTION_CHANNELS`/`RESOLUTION_TIMES`/`INTERACTION_OWNERS`
// (agent-next-gen-interaction-dashboard.tsx — the same pools the per-customer
// "Latest Interactions" accordion table already draws from, see that file's
// own `buildInteractions`) and `CREATE_NEW_CUSTOMERS` (lyra-ui's shared
// "customer database" fixture, `@nicecxone/lyra-ui/customers-data` — already
// backing the Customers tab and Contact History's own customer-derived rows)
// rather than a third, disconnected name/channel pool — no new records were
// needed in that shared fixture, its existing 60 already give this table
// plenty of variety once cycled with a different count/offset. Deliberately
// a NEW, richer type (`InteractionHistoryRecord`) rather than widening the
// existing `ContactInteraction`/`InteractionsTable` (agent-next-gen-customers-
// table.tsx) to fit — that pair is still used, unmodified, by the per-customer
// accordion, and per CLAUDE.md's lyra-ui rule (never change a shared thing's
// existing behavior/shape for one new need), this tab gets its own type
// instead of risking that other, narrower consumer.
import { useState, useMemo } from "react";
import {
  type SortDirection,
  type DateRangeFilterValue,
  type DateRangePickerProps,
  type ToastItem,
  Select,
  Badge,
  Checkbox,
  DateRangeFilterChip,
  Popover,
  Menu,
  Button,
  Textarea,
  Tooltip,
  useColumnReorder,
  TableToolbar,
  ColumnToggle,
  Table,
  TableHeader,
  TableRow,
  SortableTableHead,
  TableHead,
  TableBody,
  TableCell,
  TableFooter,
  KebabMenuButton,
  type MenuEntry,
} from "@nicecxone/lyra-ui";
import { CREATE_NEW_CUSTOMERS } from "@nicecxone/lyra-ui/customers-data";
import { CREATE_NEW_AGENTS } from "@nicecxone/lyra-ui/agents-data";
import {
  INTERACTION_CHANNELS,
  RESOLUTION_TIMES,
  INTERACTION_OWNERS,
} from "@/components/agent-next-gen-interaction-dashboard";
import { OUTBOUND_SKILLS } from "@/components/agent-next-gen-outbound-data";
import {
  SESSION_STATUS_TO_CONTACT_HISTORY_VARIANT,
  type ContactHistoryEntry,
} from "@/components/agent-next-gen-contact-history";
import { nextCustomerSortDirection, CURRENT_AGENT_NAME } from "@/components/agent-next-gen-shared-utils";
import { cn } from "@/lib/utils";
import { channelOn, onEnabledChannels } from "@/contact-handling/channel-gates";
import { useSettings } from "@/settings";
import {
  Mail,
  Phone,
  MessageCircle,
  ArrowDown,
  ArrowUp,
  RefreshCw,
  Plus,
  PhoneOutgoing,
  RotateCcw,
  UserCheck,
  UserPlus,
  Users,
  Tag,
  Send,
} from "lucide-react";

/* ── Data model ── */

// Same 5-status vocabulary `ContactHistoryEntry`/`SESSION_STATUS_TO_CONTACT_
// HISTORY_VARIANT` already established (contact-history.tsx) — the literal
// keys of that map, reused directly (rather than re-deriving them via
// `keyof typeof`, which would only resolve to `string` — that const's own
// type annotation is `Record<string, ContactHistoryStatusVariant>`, so its
// keys aren't preserved as a literal union) so a status reads the same
// color everywhere in this app. Wider than `ContactInteraction["status"]`'s
// own binary "open"/"closed" (the per-customer accordion table's type) —
// per explicit request to "vary the status" for this fuller top-level view.
export type InteractionHistoryStatus = "Open" | "Pending" | "Escalated" | "Resolved" | "Closed";

export interface InteractionHistoryRecord {
  id: string;
  priority: number;
  /** "" for an unassigned interaction — rendered as an empty cell, matching
   *  the reference screenshot's own blank Owner Assignee rows. */
  ownerAssignee: string;
  type: "email" | "chat" | "voice";
  direction: "inbound" | "outbound";
  /** Real `Date` (not just a display string) — what Create Date sorting and
   *  the "Create Date" `DateRangeFilterChip` (see this file's own filter
   *  section below) actually filter on. */
  createDateValue: Date;
  createDate: string;
  status: InteractionHistoryStatus;
  channel: string;
  /** One of `RESOLUTION_TIMES`, or "—" while still open — sorted by that
   *  array's own index (already ordered shortest → longest) rather than a
   *  separate numeric-seconds field, since every value here is drawn from
   *  that one fixed, pre-ordered pool. */
  resolutionTime: string;
  skill: string;
  customerName: string;
  context: string;
  inboxAssignee: string;
  caseId: string;
  firstResponseTime: string;
  /** Filterable only — per explicit precedent, `ContactHistoryEntry.tags`
   *  (contact-history.tsx) is "not rendered anywhere on the card itself...
   *  purely a filterable attribute"; this follows the same shape rather
   *  than adding a Tag column nothing in the reference screenshot shows. */
  tags: string[];
}

const CONTEXT_SNIPPETS = [
  "Customer asking about a recent charge on their statement.",
  "Password reset — locked out after multiple failed attempts.",
  "Requesting a plan upgrade with feature comparison.",
  "Shipping delay follow-up on an existing order.",
  "Reporting a bug in the mobile app's checkout flow.",
  "Cancellation request — exploring retention offer first.",
  "Following up on an open support ticket from last week.",
  "Asking how to update billing address on file.",
  "Disputing a duplicate transaction.",
  "General product question ahead of renewal.",
];
const INBOX_ASSIGNEES = ["Support Inbox", "Billing Inbox", "VIP Concierge Inbox", "General Inbox", "Escalations Inbox"];
// Full agent roster (100 names) for the bulk-actions "Assign to Others"
// picker — per explicit request, "all of the available agents that are in
// the database," not just the 7-name `INTERACTION_OWNERS` pool this table's
// mock rows are seeded from. Same "database" `OUTBOUND_AGENTS` (agent-next-
// gen-outbound-data.tsx) already draws from for the New Outbound "Agents"
// group — reused directly here rather than a third, disconnected agent
// list. Sorted alphabetically (the source data itself isn't) since a
// hundred-name menu is meaningfully easier to scan sorted than in its raw
// generation order.
const ALL_AGENT_NAMES = [...CREATE_NEW_AGENTS].map((a) => a.name).sort((a, b) => a.localeCompare(b));
// Real "Skills" database (agent-next-gen-outbound-data.tsx's own
// `OUTBOUND_SKILLS`, the same list New Outbound's own "Skills" group draws
// from) — the "available skills" the bulk-actions "Assign to Others"
// picker offers once its Agent/Skill type selector is switched to Skill.
const ALL_SKILL_NAMES = OUTBOUND_SKILLS.map((s) => s.name).sort((a, b) => a.localeCompare(b));
// `Select` option-list shape ({value, label}) for the bulk-actions "Assign
// to Others" popover's two selects: the small Agent/Skill type toggle, and
// the actual value picker whose own options swap between these two lists
// depending on which type is chosen (see `InteractionBulkActionIcons`).
const ASSIGN_TARGET_TYPE_OPTIONS = [
  { value: "agent", label: "Agent" },
  { value: "skill", label: "Skill" },
];
const AGENT_ASSIGN_OPTIONS = ALL_AGENT_NAMES.map((name) => ({ value: name, label: name }));
const SKILL_ASSIGN_OPTIONS = ALL_SKILL_NAMES.map((name) => ({ value: name, label: name }));
const INTERACTION_TAGS_POOL = ["VIP", "Follow-up", "Billing", "Technical", "Escalation Risk", "New Customer"];
const INTERACTION_STATUSES = Object.keys(SESSION_STATUS_TO_CONTACT_HISTORY_VARIANT) as InteractionHistoryStatus[];

function formatInteractionDate(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(-2);
  const hour24 = d.getHours();
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  const minute = String(d.getMinutes()).padStart(2, "0");
  return `${mm}/${dd}/${yy} ${hour12}:${minute} ${hour24 >= 12 ? "PM" : "AM"}`;
}

/** Deterministic (no `Math.random`, same reasoning every other mock-data
 *  builder in this app follows) — cycles through `CREATE_NEW_CUSTOMERS`
 *  (60 records) and `INTERACTION_CHANNELS` (7) more than once as `count`
 *  grows past either, same "reuse the pool, vary everything else by index"
 *  approach `buildInteractions` itself already uses. */
function buildInteractionHistory(count: number): InteractionHistoryRecord[] {
  const now = Date.now();
  return Array.from({ length: count }, (_, i) => {
    const customer = CREATE_NEW_CUSTOMERS[i % CREATE_NEW_CUSTOMERS.length];
    const source = INTERACTION_CHANNELS[i % INTERACTION_CHANNELS.length];
    const status = INTERACTION_STATUSES[i % INTERACTION_STATUSES.length];
    const isOpen = status === "Open";
    // Spread over roughly the last 90 days, newest-first as `i` grows —
    // real `Date` math (not a formatted-string guess) so the Create Date
    // column and the Filter Options date range both filter on the same
    // real value.
    const createDateValue = new Date(now - i * 37 * 60 * 1000 - (i % 17) * 3600 * 1000);
    return {
      id: `ih-${i}`,
      priority: i % 4,
      ownerAssignee: i % 5 === 0 ? "" : INTERACTION_OWNERS[(i * 3) % INTERACTION_OWNERS.length],
      type: source.type,
      direction: i % 2 === 0 ? "inbound" : "outbound",
      createDateValue,
      createDate: formatInteractionDate(createDateValue),
      status,
      channel: source.channel,
      resolutionTime: isOpen ? "—" : RESOLUTION_TIMES[(i * 5 + 1) % RESOLUTION_TIMES.length],
      skill: source.skill || "General",
      customerName: customer.name,
      context: CONTEXT_SNIPPETS[i % CONTEXT_SNIPPETS.length],
      inboxAssignee: INBOX_ASSIGNEES[i % INBOX_ASSIGNEES.length],
      caseId: customer.customerId,
      firstResponseTime: isOpen ? "—" : RESOLUTION_TIMES[i % RESOLUTION_TIMES.length],
      tags: [INTERACTION_TAGS_POOL[i % INTERACTION_TAGS_POOL.length], ...(i % 3 === 0 ? [INTERACTION_TAGS_POOL[(i + 2) % INTERACTION_TAGS_POOL.length]] : [])],
    };
  });
}

/** Relative "Nm ago"/"Nh ago"/"Nd ago" string for a row's real
 *  `createDateValue` — the same style of string every hand-authored
 *  `ContactHistoryEntry.timeAgo` in this app already uses (e.g. "34m ago",
 *  "2h ago"), computed live here since `InteractionHistoryRecord` has no
 *  such field of its own (just the real `Date`). Used only by
 *  `buildContactHistoryEntryFromInteractionRecord` below. */
function formatInteractionRecordTimeAgo(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.max(0, Math.floor(diffMs / 60000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/**
 * Adapts a row from this table into `ContactHistoryEntry`'s own shape
 * (agent-next-gen-contact-history.tsx) — per explicit follow-up request
 * ("in the dashboard / contacts table - when one of the rows is clicked,
 * open an interior panel like the ones in My Contact History"), this lets
 * a click on this table's row reuse that file's existing
 * `ContactHistoryEntryDetail` summary component (Duration/Chat Summary box
 * + synthesized Conversation/Transcript/Body section) unchanged, rather
 * than building a second, parallel detail view for a data shape that's
 * already 90% the same information under different field names —
 * `SESSION_STATUS_TO_CONTACT_HISTORY_VARIANT` already covers every status
 * this table's own `InteractionHistoryStatus` can produce (both pull from
 * the same Open/Pending/Escalated/Resolved/Closed vocabulary), and
 * `record.type` (email/chat/voice) is already a strict subset of
 * `ChannelType`.
 *
 * Field mapping: `statusLabel`/`caseId`/`skillName` map straight across
 * (`record.status`/`caseId`/`skill`); `description` uses `record.context`
 * (the same short one-line case summary `ContactHistoryEntry.description`
 * is), `duration` uses `record.resolutionTime` ("—" while still open, same
 * placeholder `ContactHistoryEntryDetail` already renders as plain text
 * either way), and `timeAgo` is computed fresh from the row's real
 * `createDateValue` via `formatInteractionRecordTimeAgo` above (this
 * table's own rows carry a real `Date`, unlike `ContactHistoryEntry`'s
 * hand-authored `timeAgo` strings). `redial` is true only for `voice` rows,
 * matching every other `ContactHistoryEntry` consumer's own "Redial is
 * voice-only" convention. `messages`/`email`/`phone` are
 * left undefined — `ContactHistoryEntryDetail` already falls back to its
 * own synthesized `buildContactHistoryMessages`/`buildContactHistoryEmailBody`
 * for every entry with no real transcript behind it, the same fallback
 * every hand-authored Contact History row already relies on.
 */
export function buildContactHistoryEntryFromInteractionRecord(record: InteractionHistoryRecord): ContactHistoryEntry {
  return {
    id: record.id,
    name: record.customerName,
    statusLabel: record.status,
    statusVariant: SESSION_STATUS_TO_CONTACT_HISTORY_VARIANT[record.status] ?? "neutral",
    redial: record.type === "voice",
    description: record.context,
    caseId: record.caseId,
    skillName: record.skill,
    channelType: record.type,
    channelLabel: record.channel,
    timeAgo: formatInteractionRecordTimeAgo(record.createDateValue),
    duration: record.resolutionTime,
    customerId: record.caseId,
  };
}

// Seed data only — `InteractionsListView` copies this into its own `records`
// state (see that component's own `useState` below) so the bulk-actions
// toolbar (Assign to Me/Assign to Others/Change Status/Send Message) can
// actually mutate `ownerAssignee`/`status`/`context` on selected rows.
// Nothing outside `InteractionsListView` reads live data through this name —
// `INTERACTION_HISTORY_FILTER_VALUE_OPTIONS` below only needs it to enumerate
// the fixed set of distinct values a fresh page load starts with, which
// bulk-editing existing rows never changes (it never introduces a new
// channel/skill value, only reassigns owner/status among values already in
// that set).
export const INITIAL_INTERACTION_HISTORY_RECORDS: InteractionHistoryRecord[] = buildInteractionHistory(140);

/* ── Columns ── */

export type InteractionHistoryColKey =
  | "priority" | "ownerAssignee" | "type" | "createDate" | "status" | "channel" | "resolutionTime" | "skill"
  | "customerName" | "context" | "inboxAssignee" | "caseId" | "firstResponseTime";

// Same proportional `flex-[n]` + `minWidthPx` shape `CUSTOMER_COLUMN_CONFIG`
// (agent-next-gen-customers-table.tsx) already established — see that
// const's own doc comment for why both a Tailwind class AND a plain number
// are needed (the table's real horizontal-scroll `min-width`).
export const INTERACTION_HISTORY_COLUMN_CONFIG: Record<InteractionHistoryColKey, { label: string; flex: string; minWidth: string; minWidthPx: number }> = {
  priority:          { label: "Priority",           flex: "flex-[0.6]", minWidth: "min-w-[70px]",  minWidthPx: 70 },
  ownerAssignee:     { label: "Owner Assignee",      flex: "flex-[1.3]", minWidth: "min-w-[140px]", minWidthPx: 140 },
  type:              { label: "Type",                flex: "flex-[0.7]", minWidth: "min-w-[70px]",  minWidthPx: 70 },
  createDate:        { label: "Create Date",         flex: "flex-[1.1]", minWidth: "min-w-[130px]", minWidthPx: 130 },
  status:            { label: "Status",              flex: "flex-1",     minWidth: "min-w-[110px]", minWidthPx: 110 },
  channel:           { label: "Channel",             flex: "flex-[1.3]", minWidth: "min-w-[150px]", minWidthPx: 150 },
  resolutionTime:    { label: "Resolution Time",     flex: "flex-1",     minWidth: "min-w-[120px]", minWidthPx: 120 },
  skill:             { label: "Skill",               flex: "flex-1",     minWidth: "min-w-[120px]", minWidthPx: 120 },
  customerName:      { label: "Customer Name",       flex: "flex-[1.2]", minWidth: "min-w-[140px]", minWidthPx: 140 },
  context:           { label: "Context",             flex: "flex-[1.8]", minWidth: "min-w-[220px]", minWidthPx: 220 },
  inboxAssignee:     { label: "Inbox Assignee",      flex: "flex-[1.2]", minWidth: "min-w-[140px]", minWidthPx: 140 },
  caseId:            { label: "Case ID",             flex: "flex-1",     minWidth: "min-w-[120px]", minWidthPx: 120 },
  firstResponseTime: { label: "First Response Time", flex: "flex-[1.2]", minWidth: "min-w-[140px]", minWidthPx: 140 },
};
export const INTERACTION_HISTORY_ALL_COLUMN_KEYS = Object.keys(INTERACTION_HISTORY_COLUMN_CONFIG) as InteractionHistoryColKey[];
export const INTERACTION_HISTORY_ALL_COLUMN_DEFS = INTERACTION_HISTORY_ALL_COLUMN_KEYS.map((key) => ({
  key,
  label: INTERACTION_HISTORY_COLUMN_CONFIG[key].label,
}));
// Priority/Owner Assignee/Type/Create Date/Status/Channel/Resolution Time/
// Skill visible by default, Customer Name/Context/Inbox Assignee/Case ID/
// First Response Time hidden — matches the reference screenshot's own
// "Columns" panel split (8 above the divider, 5 below).
export const INTERACTION_HISTORY_DEFAULT_VISIBLE_COLUMNS = new Set<InteractionHistoryColKey>([
  "priority", "ownerAssignee", "type", "createDate", "status", "channel", "resolutionTime", "skill",
]);
export const INTERACTION_HISTORY_FIXED_COLUMNS_WIDTH = 40 /* checkbox */ + 48 /* actions */;

/* ── Filters ── */

type InteractionHistoryFilterKey = "channel" | "status" | "skill" | "inboxAssignee" | "ownerAssignee" | "tags";

// Rendered as real `FilterChip`s via `TableToolbar`'s own `filterDefs` prop
// (table.tsx — "Declarative filter definitions — renders FilterChip
// components automatically") once added, same as `CUSTOMER_FILTER_FIELD_
// DEFS` (agent-next-gen-customers-table.tsx) already does for the Customers
// tab.
export const INTERACTION_HISTORY_FILTER_FIELD_DEFS: { key: InteractionHistoryFilterKey; label: string }[] = [
  { key: "channel", label: "Channel" },
  { key: "status", label: "Status" },
  { key: "skill", label: "Skill" },
  { key: "inboxAssignee", label: "Inbox Assignee" },
  { key: "ownerAssignee", label: "Owner Assignee" },
  { key: "tags", label: "Tag" },
];

// Distinct values actually present in `INTERACTION_HISTORY_RECORDS` for each
// filterable field — same "precompute once at module load" reasoning
// `CUSTOMER_FILTER_VALUE_OPTIONS` already uses (the dataset never changes
// at runtime).
const INTERACTION_HISTORY_FILTER_VALUE_OPTIONS: Record<InteractionHistoryFilterKey, { value: string; label: string }[]> = {
  channel: Array.from(new Set(INITIAL_INTERACTION_HISTORY_RECORDS.map((r) => r.channel))).map((v) => ({ value: v, label: v })),
  status: INTERACTION_STATUSES.map((v) => ({ value: v, label: v })),
  skill: Array.from(new Set(INITIAL_INTERACTION_HISTORY_RECORDS.map((r) => r.skill))).map((v) => ({ value: v, label: v })),
  inboxAssignee: INBOX_ASSIGNEES.map((v) => ({ value: v, label: v })),
  ownerAssignee: INTERACTION_OWNERS.map((v) => ({ value: v, label: v })),
  tags: INTERACTION_TAGS_POOL.map((v) => ({ value: v, label: v })),
};

// "Create Date" joins the same "+ Filter" add-menu as the 6 categorical
// fields above, but a date RANGE doesn't fit `ToolbarFilterDef`'s plain
// string[]-of-picked-values shape — so it's a separate constant (not folded
// into `INTERACTION_HISTORY_FILTER_FIELD_DEFS`, which only ever holds
// fields `filterDefs` can render automatically) and gets its own
// `DateRangeFilterChip` rendered directly in `InteractionsListView`'s
// `filters` slot once added, right alongside the `filterDefs`-driven chips.
const CREATE_DATE_RANGE_KEY = "createDateRange";
export const INTERACTION_HISTORY_ADDABLE_FILTER_OPTIONS: { value: string; label: string }[] = [
  ...INTERACTION_HISTORY_FILTER_FIELD_DEFS.map((f) => ({ value: f.key, label: f.label })),
  { value: CREATE_DATE_RANGE_KEY, label: "Create Date" },
];

/** Real start/end `Date` bounds for a `DateRangeFilterChip` selection —
 *  that component only tracks WHICH range is selected (`DateRangeFilterValue`
 *  + a `custom` picker value); nothing about it computes actual boundaries,
 *  since its other consumers (Contact History's card, Performance/
 *  Productivity) only use their selection to swap which pre-built static
 *  dataset shows, never to filter real records by real date math the way
 *  this table needs to. `"last30"`/`"last90"` aren't in this table's own
 *  `DATE_RANGE_FILTER_OPTIONS` default list, but handled here anyway for
 *  completeness against the full `DateRangeFilterValue` union. */
function dateRangeBounds(value: DateRangeFilterValue, custom: DateRangePickerProps["value"]): { from?: Date; to?: Date } {
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
  const daysAgo = (n: number) => { const d = new Date(now); d.setDate(d.getDate() - n); return d; };
  switch (value) {
    case "today": return { from: startOfDay(now), to: endOfDay(now) };
    case "yesterday": { const y = daysAgo(1); return { from: startOfDay(y), to: endOfDay(y) }; }
    case "last7": return { from: startOfDay(daysAgo(6)), to: endOfDay(now) };
    case "last30": return { from: startOfDay(daysAgo(29)), to: endOfDay(now) };
    case "last90": return { from: startOfDay(daysAgo(89)), to: endOfDay(now) };
    case "custom": return custom?.from ? { from: startOfDay(custom.from), to: endOfDay(custom.to ?? custom.from) } : {};
    default: return {};
  }
}

/* ── Row actions ── */

// Same "Redial for voice, Reopen otherwise" split `InteractionRowActions`
// (agent-next-gen-customers-table.tsx) already uses for the per-customer
// accordion's own kebab — mirrored here rather than reused directly since
// that component is typed to `ContactInteraction`, not this file's own
// `InteractionHistoryRecord`. Still presentational only (no `onClick` on
// these individual menu entries) — unlike the ROW itself (see
// `onOpenInteraction`, `InteractionsListViewProps`, and this file's
// `TableRow`'s own `onClick` further down, which now does open a real
// assignment), "Redial"/"Reopen"/"Assign To Me" here don't do anything
// yet; the kebab's own trigger stops click propagation (its wrapping
// `TableCell`, see the row render below) purely so opening THIS menu
// doesn't also fire the row's own open-assignment click underneath it.
function InteractionHistoryRowActions({ record }: { record: InteractionHistoryRecord }) {
  const items: MenuEntry[] = [
    record.type === "voice"
      ? { id: "redial", label: "Redial", icon: <PhoneOutgoing className="h-4 w-4" strokeWidth={1.5} /> }
      : { id: "reopen", label: "Reopen", icon: <RotateCcw className="h-4 w-4" strokeWidth={1.5} /> },
    { id: "assign-to-me", label: "Assign To Me", icon: <UserPlus className="h-4 w-4" strokeWidth={1.5} /> },
  ];
  return <KebabMenuButton items={items} ariaLabel="More options" />;
}

/* ── Bulk action icons ── */

// Rendered in `TableToolbar`'s own `actions` slot — the same right-side
// icon-button row `Refresh`/Reset/`ColumnToggle` already occupy — in place
// of the old standalone "N selected / Assign to Me / ..." bar this file
// used to render below the toolbar, and in the exact spot the Reset
// (trash) action used to sit, per explicit request: none of these bulk
// actions delete anything, so a trash-can icon there was always the wrong
// affordance, and it's now gone outright rather than replaced with a
// different icon in the same slot. Only rendered while at least one row is
// checked (`selectedIds.size > 0`, `InteractionsListView`'s own call
// site) — with nothing selected, that space is simply back to just
// Refresh + `ColumnToggle`.
//
// Each action is a plain icon `Button` (`variant="icon" size="icon"`, the
// same shape `TableToolbar`'s own `actionDefs` icons use internally,
// table.tsx) wrapped in `Tooltip` for its label — an icon-only button
// needs a real accessible name/visible-on-hover label, `title` alone isn't
// the styled convention this app uses elsewhere (see `panelToggleButtons`,
// table.tsx). "Assign to Others"/"Change Status"/"Send Message" additionally
// wrap a `Popover` — per the established "Tooltip wraps Popover from the
// outside" rule (lyra-ui/CLAUDE.md's Panels/menus/overlays section): the
// icon button is `Popover`'s trigger, and that whole `Popover` is `Tooltip`'s
// single child, so hovering shows the label and clicking opens the picker,
// without the two fighting over the same trigger element. "Assign to
// Others" opens the same Agent/Skill two-Select + Assign-button popover as
// before; "Change Status" opens the same status `Menu`; "Send Message"
// opens the same `Textarea` + Send button — none of that popover content
// changed, only how each one is triggered.
interface InteractionBulkActionIconsProps {
  onAssignToMe: () => void;
  onAssignToOther: (owner: string) => void;
  onAssignToSkill: (skill: string) => void;
  onChangeStatus: (status: InteractionHistoryStatus) => void;
  onSendMessage: (message: string) => void;
}

function InteractionBulkActionIcons({
  onAssignToMe,
  onAssignToOther,
  onAssignToSkill,
  onChangeStatus,
  onSendMessage,
}: InteractionBulkActionIconsProps) {
  const [assignOthersOpen, setAssignOthersOpen] = useState(false);
  // Which roster the "Assign to Others" value picker below draws its
  // options from — defaults to "agent" per explicit request. Reset back to
  // "agent" whenever the popover closes (see its own `onOpenChange` below)
  // so re-opening it always starts from the same default rather than
  // remembering whatever was last picked.
  const [assignTargetType, setAssignTargetType] = useState<"agent" | "skill">("agent");
  // Now a controlled, two-step pick: choose a value, THEN click "Assign" —
  // per explicit request, replacing the old "picking a value immediately
  // applies and closes" flow (a plain uncontrolled Select with only
  // `onValueChange`). Reset alongside `assignTargetType` (switching type
  // clears whatever value was picked for the other roster) and on close.
  const [assignValue, setAssignValue] = useState("");

  const handleAssignTargetTypeChange = (value: string) => {
    setAssignTargetType(value as "agent" | "skill");
    setAssignValue("");
  };
  const handleAssignSubmit = () => {
    if (!assignValue) return;
    if (assignTargetType === "agent") onAssignToOther(assignValue);
    else onAssignToSkill(assignValue);
    setAssignValue("");
    setAssignOthersOpen(false);
  };
  const [changeStatusOpen, setChangeStatusOpen] = useState(false);
  const [sendMessageOpen, setSendMessageOpen] = useState(false);
  const [messageDraft, setMessageDraft] = useState("");

  const changeStatusItems: MenuEntry[] = INTERACTION_STATUSES.map((status) => ({
    id: status,
    label: status,
    icon: <Badge shape="circle" dot size="sm" variant={SESSION_STATUS_TO_CONTACT_HISTORY_VARIANT[status]} aria-hidden="true" />,
    onClick: () => {
      onChangeStatus(status);
      setChangeStatusOpen(false);
    },
  }));

  const handleSendMessageSubmit = () => {
    const trimmed = messageDraft.trim();
    if (!trimmed) return;
    onSendMessage(trimmed);
    setMessageDraft("");
    setSendMessageOpen(false);
  };

  return (
    <div className="flex items-center gap-2">
      <Tooltip content="Assign to Me" placement="bottom" asLabel>
        <Button variant="icon" size="icon" onClick={onAssignToMe}>
          <UserCheck className="h-4 w-4" strokeWidth={1.5} />
        </Button>
      </Tooltip>
      <Tooltip content="Assign to Others" placement="bottom" asLabel>
        {/* Tooltip's `asChild` clone needs a real DOM element to land its
            hover/focus handlers on — `Popover` itself doesn't spread
            arbitrary props through (it only accepts its own named props),
            so wrapping it directly would silently drop them and the
            tooltip would never open. The fix (same pattern
            `ConsultTransferPopover.tsx` already uses): an inert
            `<span className="inline-flex">` sits between `Tooltip` and
            `Popover` as the actual clone target. */}
        <span className="inline-flex">
          <Popover
            open={assignOthersOpen}
            onOpenChange={(open) => {
              setAssignOthersOpen(open);
              if (!open) {
                setAssignTargetType("agent");
                setAssignValue("");
              }
            }}
            placement="bottom"
            // `bodyPadding={false}` + a `p-3` inner div — matching the Send
            // Message popover right below (self-padded content, same
            // reasoning as the Menu-based popovers' own gotcha note in
            // ../CLAUDE.md's "Panels, menus & overlays" section: don't stack
            // `Popover`'s default 20px `bodyPadding` inset on top of a
            // form's own spacing). Both popovers in this row share this one
            // padding convention rather than one using `bodyPadding`'s
            // default and the other opting out.
            bodyPadding={false}
            content={
              <div className="flex flex-col gap-2 p-3 w-[280px]">
                <Select
                  options={ASSIGN_TARGET_TYPE_OPTIONS}
                  value={assignTargetType}
                  onValueChange={handleAssignTargetTypeChange}
                  size="sm"
                />
                <Select
                  options={assignTargetType === "agent" ? AGENT_ASSIGN_OPTIONS : SKILL_ASSIGN_OPTIONS}
                  value={assignValue}
                  onValueChange={setAssignValue}
                  searchable={assignTargetType === "agent"}
                  placeholder="Select"
                  size="sm"
                />
                <Button size="md" onClick={handleAssignSubmit} disabled={!assignValue}>
                  Assign
                </Button>
              </div>
            }
          >
            <Button variant="icon" size="icon">
              <Users className="h-4 w-4" strokeWidth={1.5} />
            </Button>
          </Popover>
        </span>
      </Tooltip>
      <Tooltip content="Change Status" placement="bottom" asLabel>
        <span className="inline-flex">
          <Popover
            open={changeStatusOpen}
            onOpenChange={setChangeStatusOpen}
            placement="bottom"
            bodyPadding={false}
            content={<Menu items={changeStatusItems} bare />}
          >
            <Button variant="icon" size="icon">
              <Tag className="h-4 w-4" strokeWidth={1.5} />
            </Button>
          </Popover>
        </span>
      </Tooltip>
      <Tooltip content="Send Message" placement="bottom" asLabel>
        <span className="inline-flex">
          <Popover
            open={sendMessageOpen}
            onOpenChange={setSendMessageOpen}
            placement="bottom"
            bodyPadding={false}
            content={
              <div className="flex flex-col gap-2 p-3 w-[280px]">
                <Textarea
                  value={messageDraft}
                  onChange={(e) => setMessageDraft(e.target.value)}
                  placeholder="Type a message to attach..."
                  rows={3}
                />
                <Button size="md" onClick={handleSendMessageSubmit} disabled={!messageDraft.trim()}>
                  Send
                </Button>
              </div>
            }
          >
            <Button variant="icon" size="icon">
              <Send className="h-4 w-4" strokeWidth={1.5} />
            </Button>
          </Popover>
        </span>
      </Tooltip>
    </div>
  );
}

/* ── InteractionsListView ── */

const CHANNEL_TYPE_ICON: Record<InteractionHistoryRecord["type"], typeof Mail> = {
  email: Mail,
  voice: Phone,
  chat: MessageCircle,
};

export interface InteractionsListViewProps {
  /** Fires a toast into the shared stack `AgentNextGenPage` owns
   *  (`useToast`/`<ToastContainer>`, near the end of that component's JSX)
   *  — same "lift the toast call up, don't spin up a second independent
   *  toast stack" reasoning `fireDismissToast`/`fireAgentLegStatusToast`
   *  already follow there, so a bulk action's confirmation lands in the
   *  exact same stack (and "Dismiss All" chip) as every other toast in this
   *  app rather than a second, differently-positioned one. Optional so this
   *  component still renders standalone (e.g. in isolation) without a
   *  crash — bulk actions just silently skip the toast in that case. */
  onAddToast?: (toast: Omit<ToastItem, "id">) => void;
  /** Fired when a row is clicked (anywhere except its own checkbox/kebab —
   *  see the `TableRow`'s own `onClick` further down for the stopPropagation
   *  pattern that keeps those two working independently) — per explicit
   *  request, opens that interaction as a real, active assignment in the
   *  left nav (same "already-existing, already-routed conversation" shape
   *  `handleOpenAssignmentFromNotification` already builds from a
   *  notification click; both `AgentNextGenPage.tsx` and
   *  `AgentWorkspace2WithDeskPage.tsx` wire this to their own copy of that
   *  same handler). Optional so this component still renders standalone
   *  without a crash — a row click just silently no-ops in that case, same
   *  as `onAddToast` above. */
  onOpenInteraction?: (record: InteractionHistoryRecord) => void;
  /** Per explicit follow-up request ("when the contact row is selected show
   *  it as active and allow it to close the panel on toggle") — the id of
   *  whichever record the CALLER currently has a summary panel open for
   *  (`AgentNextGenPage.tsx`'s own `selectedAllContactsRecord`, All
   *  Contacts view — see BEHAVIOR.md §136), so that row can be shown as
   *  active here even though the panel itself lives outside this
   *  component. Deliberately a separate id rather than reusing
   *  `selectedIds` (the bulk-actions checkbox selection, above) — the two
   *  are unrelated concepts that can be true independently (a row can be
   *  checkbox-selected for a bulk action while a DIFFERENT row's panel is
   *  open) and shouldn't visually collide. Optional/`null`-safe so this
   *  component still renders standalone with no row ever marked active. */
  activeRecordId?: string | null;
}

export function InteractionsListView({ onAddToast, onOpenInteraction, activeRecordId = null }: InteractionsListViewProps = {}) {
  // Own copy of the seed data — mutated in place by the bulk-actions
  // toolbar's three "apply to every selected row" handlers below (Assign to
  // Me/Assign to Others/Change Status). `INITIAL_INTERACTION_HISTORY_RECORDS`
  // itself is never touched, so a remount (e.g. switching desk tabs away and
  // back) starts fresh rather than keeping stale bulk edits around.
  const [records, setRecords] = useState<InteractionHistoryRecord[]>(INITIAL_INTERACTION_HISTORY_RECORDS);
  const [searchQuery, setSearchQuery] = useState("");
  // Which fields the agent has added via the "+ Filter" menu — same
  // "starts empty, nothing renders until explicitly added" shape
  // `CustomersListView`'s own `addedFilterKeys` uses. Can hold
  // `CREATE_DATE_RANGE_KEY` alongside the 6 categorical
  // `InteractionHistoryFilterFieldDefs` keys — see that key's own doc
  // comment for why it's still tracked here even though it doesn't go
  // through `filterValues` below.
  const [addedFilterKeys, setAddedFilterKeys] = useState<string[]>([]);
  const [filterValues, setFilterValues] = useState<Record<string, string[]>>({});
  const [createDateRangeValue, setCreateDateRangeValue] = useState<DateRangeFilterValue>("today");
  const [createDateRangeCustom, setCreateDateRangeCustom] = useState<DateRangePickerProps["value"]>(undefined);
  const [visibleCols, setVisibleCols] = useState<Set<string>>(INTERACTION_HISTORY_DEFAULT_VISIBLE_COLUMNS);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  // Defaults to Status ascending — matches the reference screenshot's own
  // Status column sort-arrow.
  const [sortKey, setSortKey] = useState<InteractionHistoryColKey | null>("status");
  const [sortDir, setSortDir] = useState<SortDirection>("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  // Settings → Channels: the rows (below) and the Channel filter's choices follow the channels that are on.
  const [channelSettings] = useSettings("channels");
  const channelFilterOptions = useMemo(
    () =>
      Array.from(new Set(onEnabledChannels(INITIAL_INTERACTION_HISTORY_RECORDS, channelSettings, (r) => r.type).map((r) => r.channel))).map((v) => ({
        value: v,
        label: v,
      })),
    [channelSettings],
  );
  const filterDefs = addedFilterKeys
    .filter((key): key is InteractionHistoryFilterKey => key !== CREATE_DATE_RANGE_KEY)
    .map((key) => {
      const def = INTERACTION_HISTORY_FILTER_FIELD_DEFS.find((f) => f.key === key)!;
      return { key: def.key, label: def.label, options: def.key === "channel" ? channelFilterOptions : INTERACTION_HISTORY_FILTER_VALUE_OPTIONS[def.key] };
    });
  const createDateRangeAdded = addedFilterKeys.includes(CREATE_DATE_RANGE_KEY);
  const handleFilterChange = (key: string, values: string[]) => setFilterValues((prev) => ({ ...prev, [key]: values }));
  const clearAllFilters = () => setFilterValues({});
  // Removing a field from the "+ Filter" menu also drops its stored
  // selected values — same reasoning `CustomersListView`'s own
  // `handleAddedFiltersChange` gives: re-adding it later should start
  // fresh, not resurrect a stale selection nobody could see in the
  // meantime. `CREATE_DATE_RANGE_KEY` has no `filterValues` entry to prune
  // (its own state lives separately below) — removing it just stops
  // `createDateRangeAdded` from applying; its stored range/custom value is
  // deliberately left alone so re-adding it comes back where it was.
  const handleAddedFiltersChange = (keys: string[]) => {
    setAddedFilterKeys(keys);
    setFilterValues((prev) => Object.fromEntries(Object.entries(prev).filter(([k]) => keys.includes(k))));
  };

  // Nothing to actually re-fetch (this tab's data is a fixed mock set) —
  // Refresh just snaps back to page 1, same as any "reload the current
  // view" action would visually settle on the top of the list.
  const handleRefresh = () => setCurrentPage(1);

  const handleSort = (key: InteractionHistoryColKey) => {
    if (sortKey === key) {
      const next = nextCustomerSortDirection(sortDir);
      setSortDir(next);
      if (next === null) setSortKey(null);
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };
  const dirFor = (key: InteractionHistoryColKey): SortDirection => (sortKey === key ? sortDir : null);

  const { columnOrder: allColumnOrder, dragOverKey, dragHandlers } = useColumnReorder<InteractionHistoryColKey>(
    INTERACTION_HISTORY_ALL_COLUMN_KEYS
  );
  const columnOrder = allColumnOrder.filter((k) => visibleCols.has(k));
  const tableMinWidth =
    INTERACTION_HISTORY_FIXED_COLUMNS_WIDTH +
    columnOrder.reduce((sum, key) => sum + INTERACTION_HISTORY_COLUMN_CONFIG[key].minWidthPx, 0);

  const filtered = useMemo(() => {
    // Only computed/applied while "Create Date" is actually one of the
    // added filters — `dateRangeBounds` otherwise never runs and `from`/
    // `to` both stay `undefined`, matching every other field's own "no
    // entry in `filterValues` (or, here, not added at all) means no-op"
    // behavior. Computed inside this `useMemo`, not as an outer `const`,
    // purely so its dependency array can key on the three plain values
    // that actually determine it rather than a freshly-allocated `{from,
    // to}` object every render.
    const dateBounds = createDateRangeAdded ? dateRangeBounds(createDateRangeValue, createDateRangeCustom) : {};
    const query = searchQuery.trim().toLowerCase();
    return records.filter((r) => {
      // Settings → Channels: only interactions on channels that are on.
      if (!channelOn(channelSettings, r.type)) return false;
      if (query) {
        const haystack = [r.customerName, r.caseId, r.channel, r.skill, r.context, r.ownerAssignee, r.inboxAssignee].join(" ").toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      for (const [key, values] of Object.entries(filterValues)) {
        if (values.length === 0) continue;
        if (key === "tags") {
          if (!r.tags.some((t) => values.includes(t))) return false;
        } else if (!values.includes(String(r[key as InteractionHistoryFilterKey]))) {
          return false;
        }
      }
      if (dateBounds.from && r.createDateValue < dateBounds.from) return false;
      if (dateBounds.to && r.createDateValue > dateBounds.to) return false;
      return true;
    });
  }, [records, searchQuery, filterValues, createDateRangeAdded, createDateRangeValue, createDateRangeCustom, channelSettings]);

  // Priority/Create Date are real numbers/dates; Resolution/First Response
  // Time sort by their shared `RESOLUTION_TIMES` pool's own index (already
  // ordered shortest → longest, see `InteractionHistoryRecord.resolutionTime`'s
  // own doc comment); everything else is a plain case-insensitive string
  // compare.
  const sorted = useMemo(() => {
    if (!sortKey || !sortDir) return filtered;
    const dirMul = sortDir === "asc" ? 1 : -1;
    const rank = (r: InteractionHistoryRecord, key: InteractionHistoryColKey): number | string => {
      if (key === "priority") return r.priority;
      if (key === "createDate") return r.createDateValue.getTime();
      if (key === "resolutionTime" || key === "firstResponseTime") {
        const val = r[key];
        return val === "—" ? -1 : RESOLUTION_TIMES.indexOf(val);
      }
      return String(r[key]).toLowerCase();
    };
    return [...filtered].sort((a, b) => {
      const av = rank(a, sortKey);
      const bv = rank(b, sortKey);
      if (av < bv) return -1 * dirMul;
      if (av > bv) return 1 * dirMul;
      return 0;
    });
  }, [filtered, sortKey, sortDir]);

  const totalRecords = sorted.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / rowsPerPage));
  const safePage = Math.min(currentPage, totalPages);
  const startIdx = (safePage - 1) * rowsPerPage;
  const pageRows = sorted.slice(startIdx, startIdx + rowsPerPage);
  const displayStart = totalRecords === 0 ? 0 : startIdx + 1;
  const displayEnd = Math.min(startIdx + rowsPerPage, totalRecords);

  const pageIds = pageRows.map((r) => r.id);
  const allOnPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));
  const someOnPageSelected = pageIds.some((id) => selectedIds.has(id));
  const toggleSelectAllOnPage = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) pageIds.forEach((id) => next.delete(id));
      else pageIds.forEach((id) => next.add(id));
      return next;
    });
  };
  const toggleRow = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Applies one field-level change to every currently-selected row, then
  // clears the selection — same "apply then deselect" flow all three of
  // these follow, so the bulk action icons disappear (their own render is
  // gated on `selectedIds.size > 0`, `TableToolbar`'s `actions` slot below)
  // immediately after the action lands rather than lingering over rows
  // that no longer need it.
  const applyToSelected = (updater: (record: InteractionHistoryRecord) => InteractionHistoryRecord) => {
    setRecords((prev) => prev.map((r) => (selectedIds.has(r.id) ? updater(r) : r)));
    setSelectedIds(new Set());
  };
  // Success toast per bulk action, count-aware ("1 interaction"/"N
  // interactions") — fired AFTER `applyToSelected` so `selectedIds.size` is
  // still the pre-clear count read here, before that same call clears it.
  const notifyBulkAction = (message: string) => {
    onAddToast?.({ variant: "success", title: "Success", message, duration: 4000 });
  };
  const selectedCountLabel = () => `${selectedIds.size} interaction${selectedIds.size === 1 ? "" : "s"}`;

  const handleAssignToMe = () => {
    const label = selectedCountLabel();
    applyToSelected((r) => ({ ...r, ownerAssignee: CURRENT_AGENT_NAME }));
    notifyBulkAction(`${label} assigned to ${CURRENT_AGENT_NAME}.`);
  };
  const handleAssignToOther = (owner: string) => {
    const label = selectedCountLabel();
    applyToSelected((r) => ({ ...r, ownerAssignee: owner }));
    notifyBulkAction(`${label} assigned to ${owner}.`);
  };
  // Routes the selected rows to a Skill (queue) instead of a person — sets
  // `skill`, leaves `ownerAssignee` untouched, per the "Assign to Others"
  // popover's own Agent/Skill type selector (`InteractionBulkActionIcons`).
  const handleAssignToSkill = (skill: string) => {
    const label = selectedCountLabel();
    applyToSelected((r) => ({ ...r, skill }));
    notifyBulkAction(`${label} routed to ${skill}.`);
  };
  const handleChangeStatus = (status: InteractionHistoryStatus) => {
    const label = selectedCountLabel();
    applyToSelected((r) => ({ ...r, status }));
    notifyBulkAction(`${label} updated to ${status}.`);
  };
  // No real messaging/thread system behind this mock dataset — appends the
  // typed text onto each selected row's own `context` field as a visible
  // stand-in for "a message was attached to this interaction", same
  // reasoning `InteractionBulkActionIcons`'s own doc comment gives.
  const handleSendMessage = (message: string) => {
    const label = selectedCountLabel();
    applyToSelected((r) => ({ ...r, context: `${r.context} — ${message}` }));
    notifyBulkAction(`Message sent to ${label}.`);
  };

  const renderCell = (record: InteractionHistoryRecord, key: InteractionHistoryColKey) => {
    if (key === "type") {
      const ChannelIcon = CHANNEL_TYPE_ICON[record.type];
      return (
        <span className="relative inline-flex h-4 w-4 items-center justify-center">
          <ChannelIcon className="h-4 w-4 text-lyra-fg-secondary" strokeWidth={1.5} />
          {record.direction === "inbound" ? (
            <ArrowDown className="absolute -bottom-1 -left-1 h-3 w-3 rounded-full bg-lyra-bg-surface-base p-[1px]" strokeWidth={2} />
          ) : (
            <ArrowUp className="absolute -bottom-1 -left-1 h-3 w-3 rounded-full bg-lyra-bg-surface-base p-[1px]" strokeWidth={2} />
          )}
        </span>
      );
    }
    if (key === "status") {
      return (
        <span className="inline-flex items-center gap-1.5">
          <Badge shape="circle" dot size="sm" variant={SESSION_STATUS_TO_CONTACT_HISTORY_VARIANT[record.status]} aria-hidden="true" />
          {record.status}
        </span>
      );
    }
    const value = record[key];
    return value === "" ? "" : String(value);
  };

  return (
    <div className="flex flex-col flex-1 min-w-0 min-h-0 overflow-hidden">
      <TableToolbar
        className="px-6"
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search"
        filterDefs={filterDefs}
        filterValues={filterValues}
        onFilterChange={handleFilterChange}
        onFilterClear={clearAllFilters}
        // The "+ Filter" add-menu itself, right after the `filterDefs`-
        // driven chips it decides the contents of — same composition/order
        // `CustomersListView`'s own `filters` slot uses (`Select multiple
        // searchable showSelectAll`, a custom "+ Filter" trigger instead of
        // its default text box). "Create Date" lives in this SAME menu (see
        // `INTERACTION_HISTORY_ADDABLE_FILTER_OPTIONS`'s own doc comment)
        // but renders as its own `DateRangeFilterChip` before the trigger,
        // once added, rather than through `filterDefs` — that prop can only
        // render plain multi-value `FilterChip`s, not a date range.
        filters={
          <>
            {createDateRangeAdded && (
              <DateRangeFilterChip
                label="Create Date"
                value={createDateRangeValue}
                onValueChange={setCreateDateRangeValue}
                customValue={createDateRangeCustom}
                onCustomValueChange={setCreateDateRangeCustom}
              />
            )}
            <Select
              options={INTERACTION_HISTORY_ADDABLE_FILTER_OPTIONS}
              multiple
              searchable
              showSelectAll
              dropdownAlign="left"
              values={addedFilterKeys}
              onValuesChange={handleAddedFiltersChange}
              trigger={
                <button
                  type="button"
                  className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lyra-sm lyra-label transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lyra-border-focus focus-visible:ring-offset-2 border border-lyra-border-soft bg-lyra-bg-control text-lyra-fg-action hover:bg-lyra-state-hover active:bg-lyra-state-pressed h-8 px-3"
                >
                  <Plus className="h-4 w-4" strokeWidth={1.5} />
                  Filter
                </button>
              }
              className="inline-flex relative"
            />
          </>
        }
        actionDefs={[
          { key: "refresh", label: "Refresh", icon: <RefreshCw className="h-4 w-4" strokeWidth={1.5} />, onClick: handleRefresh },
        ]}
        // Bulk action icons render here — the exact slot the old "Reset"
        // (trash-can) action used to occupy — only while at least one row
        // is checked, per explicit request (none of these actions delete
        // anything, so the trash icon was removed outright rather than
        // reused for them). See `InteractionBulkActionIcons`'s own doc
        // comment.
        actions={
          <>
            {selectedIds.size > 0 && (
              <InteractionBulkActionIcons
                onAssignToMe={handleAssignToMe}
                onAssignToOther={handleAssignToOther}
                onAssignToSkill={handleAssignToSkill}
                onChangeStatus={handleChangeStatus}
                onSendMessage={handleSendMessage}
              />
            )}
            <ColumnToggle
              columns={INTERACTION_HISTORY_ALL_COLUMN_DEFS}
              visibleColumns={visibleCols}
              onVisibilityChange={setVisibleCols}
            />
          </>
        }
      />

      <div className="flex-1 min-h-0 overflow-auto px-6">
        <Table style={{ minWidth: tableMinWidth }}>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[40px] shrink-0">
                <Checkbox
                  checked={allOnPageSelected ? true : someOnPageSelected ? "indeterminate" : false}
                  onCheckedChange={toggleSelectAllOnPage}
                  aria-label="Select all rows"
                />
              </TableHead>
              {columnOrder.map((key) => {
                const col = INTERACTION_HISTORY_COLUMN_CONFIG[key];
                return (
                  <SortableTableHead
                    key={key}
                    className={cn(col.flex, col.minWidth, "relative")}
                    sortDirection={dirFor(key)}
                    onSort={() => handleSort(key)}
                    columnKey={key}
                    dragHandlers={dragHandlers}
                    isDragOver={dragOverKey === key}
                    resizable
                    minWidth={70}
                  >
                    {col.label}
                  </SortableTableHead>
                );
              })}
              <TableHead className="w-[48px] shrink-0 sticky right-0 bg-lyra-bg-surface-base">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageRows.map((record) => (
              <TableRow
                key={record.id}
                className="group cursor-pointer"
                // Either the bulk-actions checkbox selection OR this row
                // being the one whose summary panel is currently open (see
                // `activeRecordId`'s own doc comment above) shows the same
                // `data-state="selected"` highlight `TableRow` already
                // renders for checkbox selection — no new visual style
                // needed, just a second condition feeding the existing one.
                data-state={selectedIds.has(record.id) || activeRecordId === record.id ? "selected" : undefined}
                onClick={() => onOpenInteraction?.(record)}
              >
                <TableCell className="w-[40px] shrink-0" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                  <Checkbox
                    checked={selectedIds.has(record.id)}
                    onCheckedChange={() => toggleRow(record.id)}
                    aria-label={`Select interaction ${record.caseId}`}
                  />
                </TableCell>
                {columnOrder.map((key) => (
                  <TableCell key={key} columnKey={key} className={cn(INTERACTION_HISTORY_COLUMN_CONFIG[key].flex, INTERACTION_HISTORY_COLUMN_CONFIG[key].minWidth)}>
                    {renderCell(record, key)}
                  </TableCell>
                ))}
                <TableCell
                  className="w-[48px] shrink-0 sticky right-0 bg-lyra-bg-surface-base"
                  onClick={(e: React.MouseEvent) => e.stopPropagation()}
                >
                  <InteractionHistoryRowActions record={record} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <TableFooter
        className="px-6 shrink-0"
        currentPage={safePage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={(val: number) => { setRowsPerPage(val); setCurrentPage(1); }}
        totalRecords={totalRecords}
        displayStart={displayStart}
        displayEnd={displayEnd}
      />
    </div>
  );
}
