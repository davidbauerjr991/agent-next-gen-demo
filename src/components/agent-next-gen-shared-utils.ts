import type { ChannelType, SortDirection, QuickReplyField, DateRangeFilterValue, DateRange, PhoneValue, CustomerContextOverviewInfo } from "@nicecxone/lyra-ui";

/** The overview the app builds and passes around: lyra's
 *  `CustomerContextOverviewInfo`, with the Journey Summary paragraph under
 *  the app's own key (`journeySummary`). lyra's prop is still named
 *  `realTimeSummary`; it's mapped at the lyra call site. */
export type OverviewInfo = Omit<CustomerContextOverviewInfo, "realTimeSummary"> & { journeySummary?: string };

/* ── Shared, dependency-free helpers ──
   Split out of AgentNextGenPage.tsx (which had grown past Babel's 500KB
   code-generator threshold — see that file's own top-of-file note) so it
   has somewhere to import these from instead of declaring them itself.
   Every function/constant in this file is deliberately "pure" with
   respect to the rest of the app: none of them reference any OTHER
   AgentNextGenPage-specific type, component, or piece of mock data — they
   only take plain values in and return plain values out (or, for a
   handful, reference only each other, e.g. `newCaseNotificationTitle` →
   `channelNoun`, `getAwaitingSeverity` → its own two threshold constants).
   That purity is exactly what makes this file safe to sit at the BASE of
   the dependency graph: `agent-next-gen-outbound-data.ts`,
   `agent-next-gen-customer-info-panel.tsx`, and others all import from
   here, and this file imports from none of them — so there's no risk of
   a circular import no matter how many of those feature files end up
   needing the same small helper (confirmed via a dependency-graph script
   before the split, not just by inspection — see PROJECT_SUMMARY.md's
   "AgentNextGenPage split" entry if this file's own history is ever
   relevant again). */

function initialsFor(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

/** Fallback case id for interactions with no real customer/agent/team/skill
 *  record behind them (quick-dialed numbers) — same "CS-" + digits shape as
 *  every other generated case id in this file, just namespaced separately
 *  since those already-real ids come with their own prefix per record type
 *  (customerId/agentId/TEAM-.../SKL-.../ASN-...). */
function generateCaseId(): string {
  return `CS-${Math.floor(1000000 + Math.random() * 9000000)}`;
}

/** This Interaction's own real, distinct identity — same plain-numeric
 *  shape as an earlier reference screenshot ("#707535188548", 12 digits, no
 *  prefix) — distinct from `generateCaseId`'s "CS-" shape (a customer/case-
 *  level id) AND from `generateContactId`'s "CTX-" shape (a specific
 *  Contact's own id) below. Called exactly once per Interaction, at the
 *  moment a customer with no currently-open card gets engaged again (see
 *  `Interaction.interactionId`'s own doc comment, agent-next-gen-
 *  interaction-dashboard.tsx, for the full start/end lifecycle this feeds).
 *  Previously generated per-CHANNEL instead (used for `Thread`'s own,
 *  since-removed `interactionId` field, shown on its `ChannelToggle`
 *  tooltip) — repurposed here now that a real `Interaction` concept with
 *  its own id and lifecycle exists to actually use this name correctly. */
function generateInteractionId(): string {
  return String(Math.floor(100000000000 + Math.random() * 900000000000));
}

/** A specific Contact's own real id — "CTX-YYYYMMDD-NNNNN", matching the
 *  format the handful of hardcoded historical `TRANSCRIPT_SESSIONS`/`_VOICE`/
 *  `_EMAIL` mock Contacts already use for their own `caseId` (now
 *  `Contact.contactId`) — e.g. "CTX-20250722-08841". Called once per Contact
 *  (the synthetic "just launched" one, and each reopen) at the moment it's
 *  created, replacing what used to be a real, shipped bug: every live
 *  Contact's own `caseId` was set to `recordId` (now `Interaction.
 *  customerId`) — the CUSTOMER's id, not a distinct per-Contact one — so the
 *  Session Details panel's own "Contact ID" field and the "# caseId · date"
 *  separator pill both silently showed the Customer ID instead. Distinct
 *  from `generateInteractionId` above (an Interaction's own id) — a single
 *  Interaction can have several Contacts (the initial one, plus one more per
 *  reopen), each needs its own. */
function generateContactId(date: Date = new Date()): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const suffix = String(Math.floor(10000 + Math.random() * 90000));
  return `CTX-${yyyy}${mm}${dd}-${suffix}`;
}

/** Renders a tick count (seconds since the channel/interaction started) as
 *  the "MM:SS" format InteractionNavItem's `elapsed` prop expects. */
function formatElapsedTime(totalSeconds: number): string {
  const clamped = Math.max(0, totalSeconds);
  const mm = Math.floor(clamped / 60);
  const ss = clamped % 60;
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

/** Same idea as `formatElapsedTime` above but "HH:MM:SS", for the home tab's
 *  queue widgets — their wait time can run past an hour (e.g. voicemail),
 *  unlike a just-started interaction's MM:SS elapsed display. */
function formatWaitTime(totalSeconds: number): string {
  const clamped = Math.max(0, totalSeconds);
  const hh = Math.floor(clamped / 3600);
  const mm = Math.floor((clamped % 3600) / 60);
  const ss = clamped % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

/** Wait threshold (seconds) past which a just-answered channel's green
 *  "success" tier escalates to amber ("warning") — see `getAwaitingSeverity`
 *  below. Per explicit request: the moment the customer's message lands,
 *  this reads as a plain green "responded" signal, not an alert — only
 *  once it's sat unanswered this long does it actually need attention.
 *  Placeholder value; tune to whatever the real digital-channel SLA calls
 *  for.
 *
 *  TEMPORARY, per explicit request ("update the SLA timing to not display
 *  a warning until after 5 minutes... I will change this back... we are
 *  demoing and i don't want it firing during the demo"): bumped from 30s to
 *  300s (5 min) so the warning tier can't realistically fire mid-demo. The
 *  user has said they'll revert this themselves afterward — leave as-is
 *  unless told otherwise. */
const AWAITING_WARNING_SECONDS = 300;

/** Wait threshold (seconds) past which an awaiting channel escalates from
 *  amber ("warning") to red ("critical") — see `getAwaitingSeverity` below.
 *  Placeholder value; tune to whatever the real digital-channel SLA calls
 *  for.
 *
 *  TEMPORARY: bumped from 60s to 600s (10 min), same demo request as
 *  `AWAITING_WARNING_SECONDS` above — kept at 2× that constant (its
 *  original 30s/60s ratio) so critical still can't fire before warning
 *  does. */
const AWAITING_CRITICAL_SECONDS = 600;

/** Maps a channel's own "how long has it been awaiting a reply" duration
 *  (seconds since `lastCustomerMessageTick`, NOT since the channel opened —
 *  see that field's own doc comment) to the three-tier severity
 *  `InteractionNavItem`/`ChannelRow`/`ChannelTab` (lyra-ui) render, plus the
 *  "nearing/breached SLA" banner (`activeChannelAwaitingSeverity` — that one
 *  only actually renders for "warning"/"critical", treating "success" the
 *  same as no banner at all, see its own call site). Only ever called for a
 *  channel that IS awaiting — there's no separate return value for "not
 *  awaiting at all" here, that's represented by `awaitingSeverity` being
 *  omitted entirely at each call site; a channel that only just started
 *  awaiting is still very much awaiting, it just isn't overdue yet, so it
 *  gets the green "success" tier (a customer got a response promptly, this
 *  channel's own dot/color/etc. saying so) rather than no color or an
 *  immediate amber alert. */
function getAwaitingSeverity(waitSeconds: number): "success" | "warning" | "critical" {
  if (waitSeconds >= AWAITING_CRITICAL_SECONDS) return "critical";
  if (waitSeconds >= AWAITING_WARNING_SECONDS) return "warning";
  return "success";
}

/** "Email"/"SMS"/"Chat"/"Call" — the bare channel-name word shared by both
 *  `newCaseNotificationTitle` ("New {X}") and Escalation's own title
 *  ("Escalation - {X}", see `INITIAL_NOTIFICATIONS` in
 *  agent-next-gen-interaction-dashboard.tsx), so the two can't describe the
 *  same channel with two different words. SMS/WhatsApp/Chat all read as
 *  "Chat" (default branch) here — purely a notification-copy
 *  simplification local to this function, since nothing in this mock data
 *  distinguishes them from a customer's own vantage point; Voice falls
 *  back to "Call" defensively even though no current entry uses it. (Not
 *  to be confused with `ContactHistoryEntry.channelType`, agent-next-gen-
 *  contact-history.tsx — that field must carry the real channel type
 *  losslessly; a similar collapsing helper used to live there too and was
 *  removed after it caused a real, shipped bug — see that field's own doc
 *  comment.) */
function channelNoun(channel: ChannelType): string {
  switch (channel) {
    case "email":
      return "Email";
    case "sms":
      return "SMS";
    case "voice":
      return "Call";
    default:
      return "Chat";
  }
}

/** "New Email"/"New SMS"/"New Chat"/"New Call" — a "new-case" notification's
 *  title, derived from whichever channel it's actually on instead of a
 *  fixed "New Assignment" string regardless of channel, per explicit
 *  request. */
function newCaseNotificationTitle(channel: ChannelType): string {
  return `New ${channelNoun(channel)}`;
}

/* Logged-in agent — matches the "Good morning, John" home screen greeting.
   Used both to populate the Owner Assignee column and to decide whether an
   interaction's kebab menu should offer "Assign To Me" (only when it isn't
   already his). */
const CURRENT_AGENT_NAME = "John Smith";

const [CURRENT_AGENT_FIRST_NAME, CURRENT_AGENT_LAST_NAME] = CURRENT_AGENT_NAME.split(" ");

/* Home dashboard header's "Agent ID: {agentId}" subhead (`greeting=false`
   treatment) — per explicit request to bring lyra-ui's "Agent Home
   Dashboard" Storybook story's `greeting=false` header (title "Agent {name}",
   subhead "Agent ID: {agentId}" + Connect Agent Leg link/Connecting.../
   Connection Lag Time, see that story's own `AgentDashboardHeader`/
   `AgentDashboard` in agent-dashboard.tsx) into this app's real dashboard
   header. Same literal value that story's own `DEMO_AGENT_ID` constant
   uses, since it's the same "John Smith" agent. */
const CURRENT_AGENT_ID = "johnsmith329202";

/* Home dashboard header's "Connection Lag Time: {lagTime}" subhead value
   once the agent leg is connected — a fixed demo figure, not a live timer
   (there's no real network-latency measurement to show), same literal
   "00:32" lyra-ui's own "Agent Home Dashboard" story uses. */
const CURRENT_AGENT_CONNECTION_LAG_TIME = "00:32";

/* Dashboard page-header subtitle — "August 20, 2026 · 2:41 PM", read fresh
   on every render. History, in order, across several explicit follow-ups:
   originally "Wednesday, July 29, 2026 · 9:41 AM" (date + time); the
   time-of-day portion was dropped ("remove the time from the date subhead
   and just have the date"); it was then briefly replaced with a full
   sentence wrapped around the bare date ("Please review your queue and
   performance below for {Month Day, Year}", then re-worded to "Below is
   your dashboard for {Month Day, Year}"); reverted back to the bare date
   alone per a later explicit follow-up ("go back to the {Month Day, Year}
   for the subhead"); the time-of-day portion was then added back per a
   later explicit request ("add the time back to the date subhead") — the
   same request that also restored the header TITLE's own time-of-day
   greeting (see `formatHeaderGreeting` below), reversing the earlier
   VPN-timezone-unreliability reasoning that had dropped both. Still no
   weekday ("August 20, 2026," not "Thursday, August 20, 2026") — that
   "{Month Day, Year}" format is the one thing every version of this
   subtitle, sentence-wrapped or bare, has kept in common. Was
   `formatHeaderSubtitle` while it briefly held a full sentence; renamed
   back to `formatHeaderDate` once it went back to a date — kept as its own
   shared helper (rather than inlined at each of the 3 call sites) since
   it's identical across all 3 tiers. It reads `new Date()` on whichever
   render calls it. That used to mean "live for free," because the page
   re-rendered every second. Since the page clock moved into self-ticking
   components (agent-next-gen-page-clock.ts), it no longer does: a caller
   that needs this to stay live must render it inside a `<ClockValue>`.
   Neither workspace page calls it today. */
function formatHeaderDate(): string {
  const now = new Date();
  const datePart = now.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
  const timePart = now.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `${datePart} · ${timePart}`;
}

/* Dashboard page-header title — "Good Morning/Afternoon/Evening, {name}",
   read fresh on every render off the agent's local clock (same caveat as
   `formatHeaderDate` above: no longer refreshed by a page-wide tick).
   History: this started as
   a time-of-day greeting ("Good morning, John"), was flattened to a plain
   "Welcome Back, {name}" per an explicit follow-up reasoning that an
   agent's local clock/timezone isn't reliable when connected through a VPN
   whose exit point sits elsewhere — then restored to a time-of-day greeting
   again per a later explicit request ("update the page header on the home
   page to say 'Good {Morning/Evening/Afternoon}, {Name}'"), which
   supersedes that earlier VPN-timezone concern. Boundaries (5am–11:59am
   "Morning", 12pm–4:59pm "Afternoon", otherwise "Evening") are a common
   convention, not something explicitly specified. Takes `name` as a
   parameter rather than hardcoding `CURRENT_AGENT_FIRST_NAME` itself, since
   all 3 call sites already import that constant separately for other uses
   (e.g. the welcome modal's own greeting). */
function formatHeaderGreeting(name: string): string {
  const hour = new Date().getHours();
  const partOfDay = hour < 12 ? "Morning" : hour < 17 ? "Afternoon" : "Evening";
  return `Good ${partOfDay}, ${name}`;
}

/* Deterministic 12-digit case-ID generator (no Math.random, so the dashboard
   renders the same sample data on every load) */
function makeCaseId(seed: number, i: number): string {
  return String(470000000000 + seed * 111111 + i * 7777);
}

function formatCreateDate(seed: number, i: number): string {
  const month = 1 + ((seed * 5 + i) % 12);
  const day = 1 + ((seed * 3 + i * 5) % 28);
  const year = 24 + ((seed + i) % 3);
  const hour24 = (seed * 2 + i * 3) % 24;
  const minute = (seed * 7 + i * 13) % 60;
  const isPM = hour24 >= 12;
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${String(month).padStart(2, "0")}/${String(day).padStart(2, "0")}/${year} ${hour12}:${String(minute).padStart(2, "0")} ${isPM ? "PM" : "AM"}`;
}

/** "% of Team" for a single row — you as a share of the team total. 0 when the team total is 0 (avoids dividing by zero). */
function percentOfTeam(you: number, team: number): number {
  return team > 0 ? Math.round((you / team) * 100) : 0;
}

/** Drops a single channel id's entry out of a `channelStatuses` map, leaving
 *  every other channel's own status untouched — used by `handleStartCall`
 *  when a channel is restarted at the SAME address (so it reuses
 *  `Thread.id`, per that field's own doc comment): without this, a
 *  channel that was previously set to "Closed" and then redialed at the same
 *  number would silently reopen still reading "Closed" under its reused id,
 *  since nothing would otherwise clear the stale entry. Returns `undefined`
 *  (rather than an empty object) when the map is empty afterward, matching
 *  `Interaction.channelStatuses`'s own optional-when-nothing-set
 *  convention. */
function withoutChannelStatus(
  statuses: Record<string, string> | undefined,
  channelId: string
): Record<string, string> | undefined {
  if (!statuses || !(channelId in statuses)) return statuses;
  const { [channelId]: _omit, ...rest } = statuses;
  return Object.keys(rest).length > 0 ? rest : undefined;
}

function nextCustomerSortDirection(current: SortDirection): SortDirection {
  if (current === null) return "asc";
  if (current === "asc") return "desc";
  return null;
}

function nextInteractionSortDirection(current: SortDirection): SortDirection {
  if (current === null) return "asc";
  if (current === "asc") return "desc";
  return null;
}

/** One field's current raw value → its display text — a `Date` (from
 *  `DatePicker`/`TimePicker`) formats per `field.type` ("date" vs "time"
 *  need different `Date` formatting, which is why this needs the field's
 *  own type rather than just stringifying); an unset field falls back to
 *  its own `{key}` token so a still-incomplete preview reads as an
 *  obviously-unfilled blank rather than the literal word "undefined". */
function quickReplyFieldDisplayValue(field: QuickReplyField, raw: string | Date | undefined): string {
  if (raw instanceof Date) {
    return field.type === "time"
      ? raw.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
      : raw.toLocaleDateString();
  }
  if (typeof raw === "string" && raw.trim()) return raw;
  return `{${field.key}}`;
}

/* Tiny deterministic string hash → stable "random" index. Not
   cryptographic, just needs to turn a customer's `recordId` (or name, as a
   fallback) into the same pseudo-random number every time it's hashed, so
   the same customer always shows the same synthesized address/balance/zip
   across renders and reopening the panel — same intent as a seeded RNG,
   without pulling in a dependency for it. */
function hashSeed(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

/** A plausible (but invented) US phone number, formatted to match the
 *  Customer Information panel's own existing style ("+1 614 749 1794") —
 *  used only as a fallback when the active interaction has no real voice
 *  channel address to show instead (see `buildCustomerInfoFields`,
 *  agent-next-gen-customer-info-panel.tsx). */
function synthesizePhone(seed: number): string {
  const areaCode = 200 + (seed % 800);
  const exchange = 100 + (Math.floor(seed / 7) % 900);
  const line = 1000 + (Math.floor(seed / 13) % 9000);
  return `+1 ${areaCode} ${exchange} ${line}`;
}

/** Splits a customer's display name into first/last — shared by
 *  `buildCustomerInfoFields` (its synthesized email) and the Detail tab's
 *  "First Name"/"Last Name" fields, so both land on the exact same split
 *  for the same customer instead of two independently-hand-rolled
 *  versions of the same logic drifting apart. A name with no space (or no
 *  name at all) falls back to using the whole/default name as both. */
function splitCustomerName(customerName: string | undefined): { firstName: string; lastName: string } {
  const name = customerName ?? "Customer";
  const [firstName, ...restNameParts] = name.split(" ");
  const lastName = restNameParts.join(" ") || firstName;
  return { firstName, lastName };
}

/** What a record-header tab (`ChannelTab`'s own `address` prop) should show
 *  on its face — AND, just as importantly, what `Thread.value`
 *  itself should be set to — for a channel that was opened WITHOUT a real
 *  captured address: reopening a Contact History row, redialing one, or
 *  opening a row from the Interactions list all build a fresh
 *  `Thread` with no picked address of their own (no stored phone/
 *  email on either data shape), unlike `handleStartCall`'s own New
 *  Outbound/Customer-table path, which always has a real picked/typed
 *  address on hand (`selection.phone`, threaded onto both `value` and
 *  `addressLabel` there). Reuses the exact same `hashSeed`/`synthesizePhone`/
 *  `splitCustomerName` formulas `buildCustomerInfoFields`
 *  (agent-next-gen-customer-info-panel.tsx), `OUTBOUND_CUSTOMERS`, and
 *  `contactHistoryOutboundContact` (agent-next-gen-outbound-data.tsx)
 *  already use for this same customer/contact, so whatever ends up on the
 *  tab always agrees with the Customer Information panel's own
 *  "Phone #"/"Email" fields instead of inventing a second, different-
 *  looking address for the same person — pass the SAME string those two use
 *  as their own seed (a real customer's `customerId`, or the interaction's
 *  own `recordId` when there's no real customer record behind it) as
 *  `seedKey` here for that to hold.
 *
 *  This agreement is NOT just cosmetic: `create-new.tsx`'s
 *  `resolveOutboundDetailField`/`isChannelBlockedForContact` compare a
 *  contact's `openChannelAddresses[type]` (built from each open
 *  `Thread.value` — see `buildOpenChannelTagger`,
 *  AgentNextGenPage.tsx/AgentWorkspace2WithDeskPage.tsx) against that same
 *  contact's OWN `email`/`primaryPhone`/phone options (WhatsApp included)
 *  to decide whether every address for a channel is already open and the
 *  channel should disable itself. If this function's output ever drifted
 *  from the contact object's own fields, that comparison would silently
 *  never match — exactly the bug this function's `value`-wiring fixes:
 *  confirmed via screenshot that reopening Omar Farooq (a hand-authored
 *  Contact History row, `contactHistoryOutboundContact`) and then clicking
 *  the header's own Email button opened a SECOND, duplicate email channel
 *  instead of disabling itself, because `handleReopenContactHistoryEntry`
 *  only ever set the new channel's `addressLabel` (display only), never its
 *  `value` — the field `buildOpenChannelTagger` actually reads to populate
 *  `openChannelAddresses` in the first place, so that map stayed empty and
 *  nothing ever looked "already open." WhatsApp gets the same synthesized
 *  phone as voice and SMS, so its exhaustion check compares numbers (E4).
 *
 *  `chat` is the one deliberate exception, per explicit request: a website
 *  chat widget has no phone/email/handle concept anywhere in this app's
 *  data model, real or synthesized, and the visitor on the other end may
 *  not even be identified — showing a fabricated "address" for it would be
 *  actively misleading rather than just a placeholder. `"Chat {time}"`
 *  (this channel's own start time, formatted the same "h:mm AM/PM" way
 *  `TranscriptSessionSeparator`'s own session rows already do) tells the
 *  agent which chat session this tab actually is instead — chat has no
 *  `value`-based exhaustion check to satisfy either, so there's nothing
 *  this loses here. */
function synthesizeChannelAddress(
  type: ChannelType,
  seedKey: string,
  customerName: string | undefined,
  chatStartedAt: Date = new Date()
): string {
  if (type === "chat") {
    return `Chat ${chatStartedAt.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
  }
  if (type === "email") {
    const { firstName, lastName } = splitCustomerName(customerName);
    return `${firstName.toLowerCase()}.${lastName.toLowerCase()}@example.com`;
  }
  // voice / sms / whatsapp — same synthesized-phone formula as
  // `buildCustomerInfoFields`/`OUTBOUND_CUSTOMERS`. WhatsApp reaches a phone
  // number, not a handle (E4), so it's the same number voice and SMS get.
  return synthesizePhone(hashSeed(seedKey || customerName || "customer"));
}

/** "MM/DD/YYYY h:mm:ss AM/PM" — zero-padded month/day/seconds/minutes, but
 *  NOT the hour (matches the reference screenshots: "4:39:42 PM" as well as
 *  "12:58:22 PM") — deliberately hand-built rather than
 *  `Date.prototype.toLocaleString`, whose default `"en-US"` format inserts
 *  a comma before the time and never zero-pads month/day
 *  ("7/27/2026, 4:39:42 PM"). */
function formatHistoryTimestamp(date: Date): string {
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const yyyy = date.getFullYear();
  const hour24 = date.getHours();
  const ampm = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 || 12;
  const min = String(date.getMinutes()).padStart(2, "0");
  const sec = String(date.getSeconds()).padStart(2, "0");
  return `${mm}/${dd}/${yyyy} ${hour12}:${min}:${sec} ${ampm}`;
}

/** Turns a numeric seed into a run of lowercase hex digits — just enough to
 *  fake a plausible-looking UUID (`synthesizeExternalInteractionId` below);
 *  not cryptographic, and doesn't need to be, since nothing here is a real
 *  identifier. */
function seededHex(seed: number, length: number): string {
  let s = seed || 1;
  let out = "";
  while (out.length < length) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    out += s.toString(16).padStart(8, "0");
  }
  return out.slice(0, length);
}

/** UUID-shaped (8-4-4-4-12), matching the reference screenshot's "External
 *  Interaction ID" field — not a real UUID (no version/variant bits set),
 *  just deterministic filler that reads like one. */
function synthesizeExternalInteractionId(seed: number): string {
  const hex = seededHex(seed, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

/** A 12-digit numeric string, matching the reference screenshot's "External
 *  Thread ID" field. */
function synthesizeExternalThreadId(seed: number): string {
  return String(100000000000 + (seed % 900000000000));
}

/** "m:ss" — a plausible call length, from ~20 seconds up to ~14 minutes.
 *  Shown on the Conversation tab's call-notes card for `channelType ===
 *  "voice"` entries. */
function synthesizeCallDuration(seed: number): string {
  const totalSeconds = 20 + (seed % 840);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

/** Whether `timestamp` falls inside the selected date-range filter value —
 *  mirrors `DateRangeFilterChip`'s own value vocabulary
 *  (`DateRangeFilterValue`) rather than inventing a parallel one. `"custom"`
 *  with no range picked yet (`customRange` undefined/`from` unset) passes
 *  everything through, same "no filter applied yet" behavior the checklist
 *  facets elsewhere have when their own value array is empty. */
function isWithinCustomerHistoryDateRange(
  timestamp: Date,
  value: DateRangeFilterValue,
  customRange?: DateRange
): boolean {
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const today0 = startOfDay(now);

  switch (value) {
    case "today":
      return timestamp >= today0;
    case "yesterday": {
      const y0 = new Date(today0);
      y0.setDate(y0.getDate() - 1);
      return timestamp >= y0 && timestamp < today0;
    }
    case "last7": {
      const from = new Date(today0);
      from.setDate(from.getDate() - 7);
      return timestamp >= from;
    }
    case "last30": {
      const from = new Date(today0);
      from.setDate(from.getDate() - 30);
      return timestamp >= from;
    }
    case "last90": {
      const from = new Date(today0);
      from.setDate(from.getDate() - 90);
      return timestamp >= from;
    }
    case "custom": {
      if (!customRange?.from) return true;
      const from = startOfDay(customRange.from);
      const toSource = customRange.to ?? customRange.from;
      const to = new Date(toSource.getFullYear(), toSource.getMonth(), toSource.getDate(), 23, 59, 59, 999);
      return timestamp >= from && timestamp <= to;
    }
    default:
      return true;
  }
}

/** Bare digits (US-style raw phone digits, no formatting/dial code — what
 *  `PhoneInput`'s own `PhoneValue.number` expects) parsed out of one of the
 *  Customer Information panel's own already-formatted display strings
 *  (e.g. "Phone #"'s "+1 614 749 1794"). Strips a leading "1" country-code
 *  digit when present so a 10-digit US number round-trips back into
 *  `PhoneInput` correctly instead of overflowing its mask by one digit.
 *  Falls back to an empty number (still a valid, just-blank `PhoneValue`)
 *  for a synthesized phone that doesn't parse cleanly, rather than showing
 *  something wrong. */
function phoneValueFromDisplay(display: string): PhoneValue {
  const digits = display.replace(/\D/g, "");
  const withoutCountryCode = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  return { countryCode: "us", number: withoutCountryCode };
}

/** Reverse of `phoneValueFromDisplay` above — formats a `PhoneValue`'s raw
 *  digits back into this app's own "+1 XXX XXX XXXX" display style (same
 *  format `synthesizePhone` produces), so editing the Customer Overview
 *  tab's "Phone #" field via a real `PhoneInput` can round-trip back into
 *  the plain string `CustomerInfoField.value` this panel's read-only rows
 *  everywhere else expect (see `CustomerRecordDraft.overviewFields`,
 *  agent-next-gen-customer-info-panel.tsx). US-only — always prefixes
 *  "+1" rather than looking up the country's real dial code, same
 *  `countryCode` "us"-always assumption `phoneValueFromDisplay` already
 *  makes for this app's own synthesized data. Formats whatever digits
 *  exist so far (not just once all 10 are typed), grouped 3-3-4, so the
 *  field reads sensibly mid-edit too. */
function phoneDisplayFromValue(value: PhoneValue): string {
  const digits = value.number.replace(/\D/g, "");
  const groups = [digits.slice(0, 3), digits.slice(3, 6), digits.slice(6, 10)].filter(Boolean);
  return groups.length ? `+1 ${groups.join(" ")}` : "";
}

/** Small, self-contained snapshot pool, kept local to this file per its
 *  "no dependency on any other piece of mock data" rule. */
const CONTACT_OVERVIEW_SNAPSHOTS: string[][] = [
  [
    "Asked about upgrading to the Pro tier for additional storage. Walked through the upgrade flow and confirmed the new billing amount.",
    "Previously disputed a charge that was resolved in the customer's favor; handle related questions with extra care.",
  ],
  [
    "Reported intermittent login issues on mobile; traced to an outdated app version and resolved after updating.",
    "Requested a callback about a billing question that was never completed — may still be expecting a follow-up.",
  ],
  [
    "Inquired about canceling a subscription; retained after being offered a discounted plan.",
    "Long-tenured customer — prioritize a smooth, low-friction experience.",
  ],
  [
    "Had trouble setting up two-factor authentication; walked through it successfully.",
    "No prior escalations on file.",
  ],
];

/** Same fixed color `ChatMessage` itself already uses for every customer-
 *  sender avatar (lyra-ui's chat-message.tsx) — per explicit request,
 *  `buildCustomerContextOverviewInfo` below reuses this exact pair rather
 *  than a per-customer hashed color, so a customer's Customer Profile
 *  avatar always matches how that same customer already reads elsewhere
 *  in the transcript. */
const CUSTOMER_PROFILE_AVATAR_CLASS_NAME = "bg-lyra-accent-green-soft text-lyra-accent-green-strong";
const CUSTOMER_PROFILE_TIERS = ["Standard", "Silver", "Gold", "Platinum"];
const CUSTOMER_PROFILE_TAG_POOLS: string[][] = [
  ["Loyalty Member"],
  ["Auto-Pay Enrolled"],
  ["Premier Service"],
  ["Multi-Line Account"],
];
const NEXT_BEST_ACTION_RETURNING: string[] = [
  "Confirm their previous issue is fully resolved before wrapping up, and ask if there's anything else they need today.",
  "Acknowledge the earlier contact and pick up where the last conversation left off.",
  "Check in on the outcome of their last request and offer any additional help.",
];
const NEXT_BEST_ACTION_NEW: string[] = [
  "Welcome the customer and confirm the reason for today's contact.",
  "Introduce yourself and get a clear picture of what brought them in today.",
];

/** Plain-shaped prior-contact case data, extracted by the CALLING page file
 *  from its own `CONTACT_HISTORY` lookup (agent-next-gen-contact-
 *  history.tsx) and passed in here as bare fields — never `ContactHistoryEntry`
 *  itself, per this file's dependency-free rule (see this file's own top
 *  doc comment: no imports from other app-specific mock data/components/
 *  types). Lets `buildCustomerContextOverviewInfo` below ground its
 *  Customer Snapshot/Next Best Action/detailed summary in the customer's
 *  REAL prior case — per explicit bug report ("the overview you are giving"
 *  had nothing to do with the actual Contact History record for the same
 *  customer) — instead of always falling back to the generic hashed pools
 *  further up this file. Omitted entirely (the existing behavior) when the
 *  calling page finds no matching Contact History record for the active
 *  interaction. */
interface CustomerPriorContactInfo {
  /** `ContactHistoryEntry.description` — the one-line real case summary. */
  description: string;
  /** `ContactHistoryEntry.skillName` — combined with `description` to pick
   *  a category below (fraud/billing/account-access/sales/shipping) via
   *  simple keyword matching. */
  skillName: string;
  statusLabel?: string;
  /** A short excerpt pulled from the matched transcript/email body, if any
   *  — folded into the detailed summary panel so it reads like an actual
   *  synthesis of the prior conversation, not just a case label. */
  transcriptExcerpt?: string;
}

type PriorContactCategory = "fraud" | "billing" | "account-access" | "sales" | "shipping" | "general";

/** Deliberately simple substring/keyword matching against a real prior
 *  case's own `skillName`/`description` — no NLP or LLM involved, per the
 *  explicitly-confirmed "Build A now" deterministic-simulation decision
 *  (real local/LLM-backed integration, Option B, was deferred). Just
 *  enough to pick a category-appropriate Next Best Action/insight instead
 *  of one generic line for every customer. */
function categorizePriorContact(priorContact: CustomerPriorContactInfo): PriorContactCategory {
  const text = `${priorContact.skillName} ${priorContact.description}`.toLowerCase();
  if (/fraud|suspicious|unauthorized|dispute[sd]? charge/.test(text)) return "fraud";
  if (/billing|refund|charge|invoice|payment/.test(text)) return "billing";
  if (/locked|password|reset|login|technical|2fa|two-factor|authentication/.test(text)) return "account-access";
  if (/sales|upgrade|plan|subscription/.test(text)) return "sales";
  if (/shipping|delivery|delay|package|order/.test(text)) return "shipping";
  return "general";
}

const PRIOR_CONTACT_NEXT_BEST_ACTION: Record<PriorContactCategory, string> = {
  fraud:
    "Verify the customer's identity before discussing account details, confirm whether the flagged transactions have been resolved, and reassure them the account is secured.",
  billing:
    "Confirm whether the prior billing issue was fully resolved and check if any related charges still need review.",
  "account-access":
    "Confirm the customer can currently log in without issue, and offer to re-verify their security settings if needed.",
  sales: "Follow up on the plan/upgrade discussed last time and confirm it still fits their needs.",
  shipping: "Check the status of the delayed order and proactively share an updated delivery estimate.",
  general: "Acknowledge the earlier contact and pick up where the last conversation left off.",
};

const PRIOR_CONTACT_INSIGHT: Record<PriorContactCategory, string> = {
  fraud: "This customer may still be wary about account security given the prior fraud concern — lead with reassurance.",
  billing: "This customer has a recent billing dispute on file — handle any new charges with extra care.",
  "account-access": "This customer has had account-access trouble before — a quick access check up front can save time.",
  sales: "This customer has shown active interest in upgrading — a good candidate for a proactive offer.",
  shipping: "This customer is waiting on a delayed shipment — a delivery update may be the first thing they ask about.",
  general: "No special handling notes beyond the summary below.",
};

/** A real-world city/region/IANA-timezone triple — used to give an
 *  unidentified caller's "Customer Snapshot" a plausible "where they may
 *  live" line, per explicit request ("in the customer snapshot add
 *  information such as where they may live, what time it is where they
 *  are and any other geographical information"). */
export interface CustomerLocation {
  city: string;
  region: string;
  timeZone: string;
}

/** A curated (not exhaustive) set of real NANP area codes spanning all 4
 *  continental US time zones plus Alaska/Hawaii, keyed by the 3-digit area
 *  code string. `resolveCustomerLocation` below checks a caller's own
 *  phone number against this table first — a REAL match, when the
 *  synthetic phone number (`synthesizePhone` above) happens to land on one
 *  of these — before falling back to a deterministic hashed guess from
 *  `CUSTOMER_LOCATION_POOL`. Deliberately representative rather than a
 *  complete NANP area-code list (hundreds of entries) — this only needs to
 *  be plausible for a demo, not authoritative. */
export const AREA_CODE_LOCATIONS: Record<string, CustomerLocation> = {
  "212": { city: "New York", region: "NY", timeZone: "America/New_York" },
  "617": { city: "Boston", region: "MA", timeZone: "America/New_York" },
  "202": { city: "Washington", region: "DC", timeZone: "America/New_York" },
  "305": { city: "Miami", region: "FL", timeZone: "America/New_York" },
  "404": { city: "Atlanta", region: "GA", timeZone: "America/New_York" },
  "215": { city: "Philadelphia", region: "PA", timeZone: "America/New_York" },
  "313": { city: "Detroit", region: "MI", timeZone: "America/Detroit" },
  "704": { city: "Charlotte", region: "NC", timeZone: "America/New_York" },
  "407": { city: "Orlando", region: "FL", timeZone: "America/New_York" },
  "412": { city: "Pittsburgh", region: "PA", timeZone: "America/New_York" },
  "312": { city: "Chicago", region: "IL", timeZone: "America/Chicago" },
  "214": { city: "Dallas", region: "TX", timeZone: "America/Chicago" },
  "713": { city: "Houston", region: "TX", timeZone: "America/Chicago" },
  "615": { city: "Nashville", region: "TN", timeZone: "America/Chicago" },
  "504": { city: "New Orleans", region: "LA", timeZone: "America/Chicago" },
  "314": { city: "St. Louis", region: "MO", timeZone: "America/Chicago" },
  "512": { city: "Austin", region: "TX", timeZone: "America/Chicago" },
  "414": { city: "Milwaukee", region: "WI", timeZone: "America/Chicago" },
  "316": { city: "Wichita", region: "KS", timeZone: "America/Chicago" },
  "601": { city: "Jackson", region: "MS", timeZone: "America/Chicago" },
  "303": { city: "Denver", region: "CO", timeZone: "America/Denver" },
  "602": { city: "Phoenix", region: "AZ", timeZone: "America/Phoenix" },
  "505": { city: "Albuquerque", region: "NM", timeZone: "America/Denver" },
  "801": { city: "Salt Lake City", region: "UT", timeZone: "America/Denver" },
  "406": { city: "Billings", region: "MT", timeZone: "America/Denver" },
  "307": { city: "Cheyenne", region: "WY", timeZone: "America/Denver" },
  "415": { city: "San Francisco", region: "CA", timeZone: "America/Los_Angeles" },
  "213": { city: "Los Angeles", region: "CA", timeZone: "America/Los_Angeles" },
  "619": { city: "San Diego", region: "CA", timeZone: "America/Los_Angeles" },
  "503": { city: "Portland", region: "OR", timeZone: "America/Los_Angeles" },
  "206": { city: "Seattle", region: "WA", timeZone: "America/Los_Angeles" },
  "702": { city: "Las Vegas", region: "NV", timeZone: "America/Los_Angeles" },
  "916": { city: "Sacramento", region: "CA", timeZone: "America/Los_Angeles" },
  "907": { city: "Anchorage", region: "AK", timeZone: "America/Anchorage" },
  "808": { city: "Honolulu", region: "HI", timeZone: "Pacific/Honolulu" },
};

/** Hash-selectable fallback pool for a caller whose (synthetic) area code
 *  doesn't land on a real one above — every `AREA_CODE_LOCATIONS` entry
 *  doubles as a fallback candidate, so "no real match" still produces a
 *  plausible, internally consistent city rather than no geography at all. */
const CUSTOMER_LOCATION_POOL: CustomerLocation[] = Object.values(AREA_CODE_LOCATIONS);

/** Pulls a 10-digit NANP number's area code out of a raw address string
 *  (phone numbers in this app appear in various punctuated forms, e.g.
 *  `"+1 212 555 0148"`/`"(212) 555-0148"`/a bare `"2125550148""` — see
 *  `synthesizePhone` above for the shape this app itself generates).
 *  Returns `undefined` for anything that isn't phone-shaped (a chat
 *  customer's real name, an email address, etc.) — callers use that to
 *  skip the "based on the phone number" geography lines entirely rather
 *  than fabricate one for an address that was never a phone number. */
function extractAreaCode(rawAddress: string): string | undefined {
  const digits = rawAddress.replace(/\D/g, "");
  const tenDigits = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  return tenDigits.length === 10 ? tenDigits.slice(0, 3) : undefined;
}

/** Resolves a caller's likely location from their raw address (see
 *  `extractAreaCode` above) — a real `AREA_CODE_LOCATIONS` match when the
 *  digits land on one, otherwise a `hash`-seeded pick from
 *  `CUSTOMER_LOCATION_POOL` so the SAME unidentified caller reads back the
 *  same "may live near ___" city on every render instead of reshuffling.
 *  `undefined` when `rawAddress` isn't phone-shaped at all. */
function resolveCustomerLocation(rawAddress: string, hash: number): CustomerLocation | undefined {
  const areaCode = extractAreaCode(rawAddress);
  if (!areaCode) return undefined;
  return AREA_CODE_LOCATIONS[areaCode] ?? CUSTOMER_LOCATION_POOL[hash % CUSTOMER_LOCATION_POOL.length];
}

/** Turns a resolved `CustomerLocation` into the extra "Customer Snapshot"
 *  bullet lines a first-time/unidentified caller's card gets appended
 *  alongside the usual "no prior contact history" line — a plausible city/
 *  region drawn from the phone number's area code, plus that area's
 *  current local time (computed live via `Intl.DateTimeFormat`, not
 *  baked in, so it's always accurate to when the agent is actually
 *  looking at it). It runs inside the workspace controller's render, so
 *  it never throws: a time zone `Intl` rejects drops the local-time line
 *  instead of taking the workspace down. (Honolulu's entry once read
 *  "America/Honolulu", not an IANA zone; an unknown caller whose
 *  randomUUID-seeded pick landed on it crashed the render — 2026-10-22,
 *  found as a flaky copilot-result-rows test. Real customer data can carry
 *  bad zones too.) Formatters are built once per zone; a failure isn't
 *  cached. */
export function buildLocationSnapshotLines(location: CustomerLocation): string[] {
  const near = `Likely located near ${location.city}, ${location.region}, based on the phone number's area code.`;
  const formatter = localTimeFormatter(location.timeZone);
  return formatter ? [near, `Local time there is currently ${formatter.format(new Date())}.`] : [near];
}

const LOCAL_TIME_FORMATTERS = new Map<string, Intl.DateTimeFormat>();

function localTimeFormatter(timeZone: string): Intl.DateTimeFormat | undefined {
  const cached = LOCAL_TIME_FORMATTERS.get(timeZone);
  if (cached) return cached;
  try {
    const formatter = new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", minute: "2-digit", hour12: true, timeZoneName: "short" });
    LOCAL_TIME_FORMATTERS.set(timeZone, formatter);
    return formatter;
  } catch {
    return undefined;
  }
}

/** Deterministic (hashed via `hashSeed`, no `Math.random`) mock "Customer
 *  Profile"/"Customer Snapshot"/"Next Best Action" content — feeds lyra-ui's
 *  `CustomerContextOverview` (its own `CustomerContextOverviewInfo`, not
 *  imported here by name per this file's own dependency-direction rule —
 *  the returned shape just happens to match it structurally).
 *
 *  `isKnownCustomer` — a genuinely brand-new/ad-hoc contact (no backing
 *  directory record) gets no fabricated profile/snapshot, only a generic
 *  "first contact" Next Best Action. Callers seed this with the
 *  Interaction's own id, so the same customer reads back the same
 *  profile/snapshot on every fresh launch instead of reshuffling on every
 *  render.
 *
 *  `identified` — same distinction `InteractionTranscript`'s own
 *  `customerIdentified` prop makes (see its own doc comment,
 *  agent-next-gen-transcript.tsx: an actual identified customer, as
 *  opposed to a raw, unidentified address like a dialed number standing in
 *  for one). Per explicit bug report/screenshot (a customer's own PHONE
 *  NUMBER, not a real name, feeding `initialsFor` and producing a
 *  meaningless "(5" avatar): when `false`, `customerCard.avatarInitials`/
 *  `avatarClassName` come back `undefined` — `subtitle`/`tags` still
 *  populate normally either way (tier/tenure genuinely IS known even when
 *  the caller hasn't given a real name), only the avatar circle itself is
 *  suppressed (see lyra-ui's `CustomerContextOverviewInfo.customerCard`,
 *  its own `avatarInitials` doc comment, for how the component renders
 *  that). Defaults to `true` so a caller that hasn't threaded its own
 *  identified signal through yet keeps getting an avatar exactly as
 *  before.
 *
 *  `priorContact` — per explicit request/bug report (a screenshot of the
 *  real Contact History record for a customer next to this function's own
 *  generic, unrelated output for the SAME customer): when the calling page
 *  finds a matching real `CONTACT_HISTORY` case for the active interaction,
 *  it extracts the plain fields into a `CustomerPriorContactInfo` (see that
 *  type's own doc comment for why bare fields, not the real entry type) and
 *  passes it here. When present, `snapshot`/`nextBestAction`/the new
 *  `detailedSummary` are all grounded in that REAL case (category-aware via
 *  `categorizePriorContact`) instead of the hashed pools below — feeds the
 *  new "AI Customer Summary" panel (`onViewCustomerInfo`, per explicit
 *  request) as well as the Customer Snapshot card itself. Omitted (the
 *  default) preserves the original fully-hashed behavior verbatim for any
 *  customer with no real Contact History case on file. */
function buildCustomerContextOverviewInfo(
  seed: string,
  customerName: string = "",
  isKnownCustomer: boolean = true,
  identified: boolean = true,
  priorContact?: CustomerPriorContactInfo
): {
  customerCard?: { avatarInitials?: string; avatarClassName?: string; subtitle: string; tags?: string[] };
  snapshot?: string[];
  nextBestAction?: string;
  /** Fuller AI-style narrative paragraphs for the new "AI Customer
   *  Summary" side panel (`CustomerAiSummaryPanel`) — always populated for
   *  a known customer (falls back to a plain "no prior case on file" note
   *  when there's no real `priorContact` match), `undefined` only for a
   *  genuinely brand-new/unknown contact (same gate as `customerCard`). */
  detailedSummary?: string[];
  /** Feeds the Details panel's "Journey Summary" card (renamed from
   *  "Real-Time Summary"; lyra's `CustomerContextOverview` still calls the
   *  prop `realTimeSummary`, lyra-ui/contact-overview.tsx) as one flowing
   *  paragraph, grounded in
   *  this SAME contact's real facts — literally this same call's own
   *  `snapshot` lines below, joined with a space, never separately
   *  authored/random copy (per the earlier explicit "tie the autosummary
   *  to the contact so it is not random info" request). Always set
   *  alongside `snapshot` (never populated when `snapshot` itself is
   *  empty/omitted), so the two stay in lockstep automatically as the
   *  underlying facts change — one place computes the facts, both
   *  presentations read off it. */
  journeySummary?: string;
} {
  const hash = hashSeed(seed);
  if (!isKnownCustomer) {
    // Per explicit follow-up request ("if a new call is made or the
    // customer does not have any information ... in the customer snapshot
    // add information such as where they may live, what time it is where
    // they are and any other geographical information"): `customerName`
    // IS the raw dialed/caller address for an unidentified contact (see
    // this function's own `identified` doc comment above — every non-chat
    // caller gets its raw address here, not a real name), so it doubles as
    // the phone number to derive a location from. `resolveCustomerLocation`
    // returns `undefined` for anything not phone-shaped (an unidentified
    // chat "customer" — an email, a handle) — the plain "no prior contact
    // history" line is all that case gets, same as before this change.
    const location = resolveCustomerLocation(customerName, hash);
    const unknownSnapshot = [
      "No prior contact history on file — this is a new conversation.",
      ...(location ? buildLocationSnapshotLines(location) : []),
    ];
    return {
      nextBestAction: NEXT_BEST_ACTION_NEW[hash % NEXT_BEST_ACTION_NEW.length],
      snapshot: unknownSnapshot,
      journeySummary: unknownSnapshot.join(" "),
    };
  }
  const tier = CUSTOMER_PROFILE_TIERS[hash % CUSTOMER_PROFILE_TIERS.length];
  const tenureYears = 1 + (hash % 10);
  const customerCard = {
    avatarInitials: identified ? initialsFor(customerName) : undefined,
    avatarClassName: identified ? CUSTOMER_PROFILE_AVATAR_CLASS_NAME : undefined,
    subtitle: `${tier} Tier · ${tenureYears} yr${tenureYears === 1 ? "" : "s"} tenure`,
    tags: CUSTOMER_PROFILE_TAG_POOLS[hash % CUSTOMER_PROFILE_TAG_POOLS.length],
  };

  if (priorContact) {
    const category = categorizePriorContact(priorContact);
    const displayName = identified && customerName ? customerName : "This customer";
    const snapshot = [
      priorContact.description,
      priorContact.statusLabel ? `Case status: ${priorContact.statusLabel}.` : undefined,
    ].filter((line): line is string => !!line);
    const detailedSummary = [
      `${displayName} previously contacted support regarding: ${priorContact.description}`,
      PRIOR_CONTACT_INSIGHT[category],
      priorContact.transcriptExcerpt
        ? `From the prior conversation: "${priorContact.transcriptExcerpt}"`
        : undefined,
    ].filter((line): line is string => !!line);
    return {
      customerCard,
      snapshot: snapshot.length > 0 ? snapshot : undefined,
      nextBestAction: PRIOR_CONTACT_NEXT_BEST_ACTION[category],
      detailedSummary,
      journeySummary: snapshot.length > 0 ? snapshot.join(" ") : undefined,
    };
  }

  const genericSnapshot = CONTACT_OVERVIEW_SNAPSHOTS[hash % CONTACT_OVERVIEW_SNAPSHOTS.length];
  return {
    customerCard,
    snapshot: genericSnapshot,
    nextBestAction: NEXT_BEST_ACTION_RETURNING[hash % NEXT_BEST_ACTION_RETURNING.length],
    detailedSummary: [
      "No prior case history is on file for this contact yet — this summary reflects general account patterns only.",
    ],
    journeySummary: genericSnapshot.join(" "),
  };
}

/** Which top-level page the app is showing (the routes live in app-routes.ts). */
type Page = import("@/app-routes").Page;

/** Per explicit request ("hide the assignments resolved chip in the home
 *  tab"): gates the green "{n} Assignments resolved today" `Badge` each of
 *  the 3 Agent Workspace pages renders in its own home-dashboard `PageHeader`
 *  `actions` slot. Same "hide for now" flag pattern as
 *  `SHOW_CUSTOMER_INFO_AI_INPUT` (agent-next-gen-customer-info-panel.tsx) —
 *  a single shared toggle here rather than duplicated per page, since all 3
 *  pages render this same Badge from their own copy of the same JSX. The
 *  underlying `resolvedTodayCount` state/tracking is untouched — only this
 *  Badge's visibility is gated, so re-enabling it later is a one-line flip. */
const SHOW_RESOLVED_TODAY_CHIP = false;

/** Per a later explicit follow-up request ("we need an add button always
 *  visible in the button group as well — make it an outline button not
 *  full primary"), flipped back to `true` — this had been hidden per an
 *  earlier explicit request ("now hide the '+' button on interactions in
 *  the page header - I may bring it back though if I need it but hide for
 *  now"). Gates the "+" `AddChannelAdHocButton`/`getHeaderAction` trigger
 *  each of the 3 Agent Workspace pages renders inside its own record-
 *  header `ChannelToggleGroup`'s own `action` slot (2.0's
 *  `showAddChannelActions && activeChannel` branch; Premium/Advanced's
 *  unconditional `getHeaderAction(...) ?? <AddChannelAdHocButton />`
 *  branch). Same shared-toggle pattern as `SHOW_RESOLVED_TODAY_CHIP` right
 *  above — a single flag here rather than duplicating the on/off logic per
 *  page. `handleAddAdHocChannel` and everything else this button would
 *  trigger are untouched — only this button's own visibility is gated, so
 *  hiding it again later is still just a one-line flip. See each call
 *  site's own `className` for the outline (not solid-primary) look this
 *  same follow-up request also asked for. */
const SHOW_ADD_CHANNEL_HEADER_BUTTON = true;

export {
  initialsFor,
  generateCaseId,
  generateInteractionId,
  generateContactId,
  formatElapsedTime,
  formatWaitTime,
  AWAITING_WARNING_SECONDS,
  AWAITING_CRITICAL_SECONDS,
  getAwaitingSeverity,
  channelNoun,
  newCaseNotificationTitle,
  CURRENT_AGENT_NAME,
  CURRENT_AGENT_FIRST_NAME,
  CURRENT_AGENT_LAST_NAME,
  CURRENT_AGENT_ID,
  CURRENT_AGENT_CONNECTION_LAG_TIME,
  formatHeaderDate,
  formatHeaderGreeting,
  makeCaseId,
  formatCreateDate,
  percentOfTeam,
  withoutChannelStatus,
  nextCustomerSortDirection,
  nextInteractionSortDirection,
  quickReplyFieldDisplayValue,
  hashSeed,
  buildCustomerContextOverviewInfo,
  synthesizePhone,
  splitCustomerName,
  synthesizeChannelAddress,
  formatHistoryTimestamp,
  seededHex,
  synthesizeExternalInteractionId,
  synthesizeExternalThreadId,
  synthesizeCallDuration,
  isWithinCustomerHistoryDateRange,
  phoneValueFromDisplay,
  phoneDisplayFromValue,
  SHOW_RESOLVED_TODAY_CHIP,
  SHOW_ADD_CHANNEL_HEADER_BUTTON,
};
export type { Page, CustomerPriorContactInfo };
