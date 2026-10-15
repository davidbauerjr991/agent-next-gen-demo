// App menu items + "New Outbound" picker config — see
// agent-next-gen-shared-utils.ts and sibling agent-next-gen-*.ts(x) files
// for everything AgentNextGenPage.tsx itself no longer declares — split out
// once that file crossed Babel's 500KB code-generator threshold.
import { initialsFor, synthesizePhone, hashSeed, splitCustomerName } from "@/components/agent-next-gen-shared-utils";
import { CONTACT_HISTORY, type ContactHistoryEntry } from "@/components/agent-next-gen-contact-history";
import { type AppMenuGroup, type CreateNewOutboundConfig, type CreateNewOutboundContact, WhatsAppIcon } from "@nicecxone/lyra-ui";
import { CREATE_NEW_AGENTS } from "@nicecxone/lyra-ui/agents-data";
import { CREATE_NEW_CUSTOMERS } from "@nicecxone/lyra-ui/customers-data";
import type { ReactNode } from "react";
import { applyProfile, type ProfileId, type WorkspaceProfile } from "@/settings";
import { Phone, Mail, MessageSquare, MessageCircle, User, Headphones, Share2, Users, LayoutGrid, Star } from "lucide-react";

/* ── Category icons ──
   Shared between the "New Outbound" picker's "Choose group" dropdown
   (`OUTBOUND_GROUPS`'s own `icon`, further down) and each individual
   contact row within it (`CreateNewContact.categoryIcon`, create-new.tsx) —
   one constant per category so both places can never drift to different
   icons for the same category. Declared as functions (not JSX constants)
   since a single React element instance can't be reused across multiple
   render sites (agents/teams/skills/customers are each mapped into many
   rows) — React warns/misbehaves reusing one element in multiple places in
   the tree, so each call site needs its own fresh element. */
const agentCategoryIcon = () => <Headphones className="h-4 w-4" strokeWidth={1.5} />;
const teamCategoryIcon = () => <Users className="h-4 w-4" strokeWidth={1.5} />;
const skillCategoryIcon = () => <Share2 className="h-4 w-4" strokeWidth={1.5} />;
const customerCategoryIcon = () => <User className="h-4 w-4" strokeWidth={1.5} />;
// Dial Pad's own icon — a grid glyph, matching the small ghost button's
// reference mockup and the same `LayoutGrid` glyph already used
// app-wide for grid/dashboard-style nav items (AgentNextGenPage.tsx,
// AgentWorkspace2WithDeskPage.tsx, AgentWorkspaceAdvancedPage.tsx,
// Sidebar.tsx). Unlike the four categories above, this one is never
// consumed by the "Choose group" dropdown's own icon slot (see
// `OUTBOUND_GROUPS`'s `dialpad` entry below — that group is filtered
// out of the Select entirely, create-new.tsx) — it's read by the Dial
// Pad ghost button instead (`dialpadGroup.icon`, same file), which
// falls back to a hardcoded `LayoutGrid` of its own if a consumer's
// dialpad-kind group has no icon set. Kept as its own function (not a
// shared JSX constant) for the same one-element-per-render-site reason
// as the four category icons above.
const dialpadCategoryIcon = () => <LayoutGrid className="h-4 w-4" strokeWidth={1.5} />;
// Favorites' own icon — a star, matching the concept everywhere else in
// this app already uses one (`FavoriteButton`, lyra-ui) — per explicit
// follow-up request giving every row in the group list a leading icon.
const favoritesCategoryIcon = () => <Star className="h-4 w-4" strokeWidth={1.5} />;

/** Per explicit follow-up request ("put the initials of the agents/skill
 *  names/etc. inside the avatars and randomize the colors using the
 *  lyra-ui color tokens"): the per-CONTACT leading avatar (`CreateNewContact.
 *  categoryIcon`) renders that record's own `initials` as text inside a
 *  `h-9 w-9 rounded-full` shell — the same shell lyra-ui's own `ListItem`
 *  "With leading icon" story hand-builds for each of its demo rows
 *  (`ListItem.stories.tsx`), colored by `avatarClassName` — a
 *  `bg-lyra-accent-{color}-soft text-lyra-accent-{color}-strong` pair
 *  already varied per record (`CREATE_NEW_AGENTS`/`CREATE_NEW_CUSTOMERS`,
 *  lyra-ui's own fixtures, cycle through 10 real lyra-ui accent tokens;
 *  `OUTBOUND_TEAMS`/`OUTBOUND_SKILLS` below set their own per-record pair
 *  the same way) — rather than one fixed glyph/color shared by every
 *  record in a category, which made a mixed list (e.g. the "All"/
 *  favorites group) visually indistinguishable row-to-row within the same
 *  category. `lyra-label` matches `AgentProfile`'s own `Avatar` component's
 *  initials treatment (agent-profile.tsx) — `avatarClassName` supplies the
 *  text color itself, so this only adds the size/weight. */
function initialsAvatar(initials: string, avatarClassName: string): ReactNode {
  return (
    <div className={`h-9 w-9 rounded-full ${avatarClassName} flex items-center justify-center lyra-label`}>
      {initials}
    </div>
  );
}

// Same 10 lyra-ui accent tokens `CREATE_NEW_AGENTS`/`CREATE_NEW_CUSTOMERS`
// (lyra-ui's own fixtures) already cycle through for their own
// `avatarClassName` — reused here for the few records in THIS file that
// don't come from one of those fixtures (currently just
// `contactHistoryOutboundContact` below) and so have no `avatarClassName`
// of their own to reuse, so they still get a real, varied color instead of
// one hardcoded shade repeated for every row.
const OUTBOUND_AVATAR_COLORS = ["blue", "orange", "teal", "purple", "green", "red", "pink", "yellow", "lime", "slate"];
function randomAvatarClassName(seed: string): string {
  const color = OUTBOUND_AVATAR_COLORS[hashSeed(seed) % OUTBOUND_AVATAR_COLORS.length];
  return `bg-lyra-accent-${color}-soft text-lyra-accent-${color}-strong`;
}

/* ── App menu ──
   One workspace (P0.5d.2): each entry applies a built-in profile and stays
   on the page; the header and Home update in place. The entry matching the
   current profile shows as active (neither does while it's Custom).
   `onPicked` lets the page close the menu. */
export function buildAppMenuGroups(profile: WorkspaceProfile, onPicked?: () => void): AppMenuGroup[] {
  const entry = (id: ProfileId, label: string) => ({
    label,
    active: profile === id,
    onClick: () => {
      applyProfile(id);
      onPicked?.();
    },
  });
  return [
    {
      items: [entry("phase1", "Agent Workspace 2.0 | Phase 1"), entry("phase2", "Agent Workspace 2.0 | Phase 2")],
    },
  ];
}

/* ── Create New → Outbound config ──
   Mirrors lyra-ui's CreateNew "Create New → Outbound" story (see
   lyra-ui/src/components/__stories__/create-new-outbound-mock.tsx) — only
   "Outbound" is wired up, the rest render as coming-soon placeholders. Teams
   and skills below are small, app-specific lists kept local, but the agent
   and customer "database" records themselves come from lyra-ui's shared
   fixture files (via the /agents-data and /customers-data aliases in
   vite.config.ts) so this app's Outbound picker can't quietly drift out of
   sync with lyra-ui's own story — same records, mapped into the shape
   `CreateNew` expects exactly like lyra-ui's own mock file does. */

export const OUTBOUND_AGENTS: NonNullable<CreateNewOutboundConfig["groups"][number]["contacts"]> = CREATE_NEW_AGENTS.map((a) => ({
  id: a.id,
  name: a.name,
  initials: initialsFor(a.name),
  // Per explicit follow-up request: the row subhead is now this agent's
  // job title ("Support Agent"/"Team Supervisor") rather than the raw
  // `agentId` — reads as "who is this person" at a glance, matching a
  // reference mockup. `agentId` itself is untouched elsewhere (still each
  // agent's own real internal identifier), just no longer surfaced here.
  subtitle: a.role,
  avatarClassName: a.avatarClassName,
  // Per explicit request: an agent is only reachable by Voice or Chat from
  // this picker — overrides whatever `CREATE_NEW_AGENTS` itself lists (that
  // fixture's `channels` models a full agent-center directory record, not
  // what's actually dialable agent-to-agent here). Voice proceeds as a
  // normal call (`handleStartCall`'s own agent-call branch, further down in
  // each page file, then hides Customer Information + the status Select for
  // that resulting interaction); Chat instead opens the existing "Agent
  // Chat" panel and never creates an interaction at all — see
  // `OUTBOUND_CONFIG.channelOptions`'s new `"chat"` entry below.
  channels: ["voice", "chat"],
  status: a.status,
  // Per follow-up request, this is now an initials avatar (this agent's own
  // `avatarClassName`, already one of 10 randomized lyra-ui accent tokens
  // per `CREATE_NEW_AGENTS`) rather than a shared headset-glyph circle —
  // see `initialsAvatar`'s own doc comment above for why. Still shown to
  // the left of EACH agent's name — matters most in the "All"/favorites
  // group, which mixes agents/teams/skills/customers in one list with no
  // group heading between them (see `CreateNewContact.categoryIcon`'s own
  // doc comment, create-new.tsx).
  categoryIcon: initialsAvatar(initialsFor(a.name), a.avatarClassName),
  // Per explicit follow-up request: the plain (uncircled) headset glyph
  // that used to fill `categoryIcon` before it became an initials avatar
  // now sits inline next to the name instead — see `CreateNewContact.
  // typeIcon`'s own doc comment, create-new.tsx.
  typeIcon: agentCategoryIcon(),
  // Per explicit request: calling/chatting an agent skips the "Select
  // Phone"/"Outbound Skill" detail screen entirely and launches
  // immediately — an agent has no real per-contact address to choose
  // between the way a customer does. See `CreateNewOutboundContact.
  // quickLaunch`'s own doc comment (lyra-ui create-new.tsx).
  quickLaunch: true,
}));

export const OUTBOUND_CUSTOMERS: NonNullable<CreateNewOutboundConfig["groups"][number]["contacts"]> = CREATE_NEW_CUSTOMERS.map((c) => ({
  id: c.id,
  name: c.name,
  initials: initialsFor(c.name),
  subtitle: c.customerId,
  avatarClassName: c.avatarClassName,
  channels: c.channels,
  // Matches `buildCustomerInfoFields`'s own synthesized "Phone #" exactly
  // (same `hashSeed`/`synthesizePhone`, same seed input) — both are
  // deterministic functions of the customer's own id, so "Select Phone"'s
  // default here and the Customer Information panel's Directory tab always
  // agree on the same "primary" number for a given customer, without one
  // needing to read the other's state. `hashSeed`/`synthesizePhone` are
  // `function` declarations further down this file, hoisted, so they're
  // callable up here despite being defined later.
  primaryPhone: { value: synthesizePhone(hashSeed(c.customerId || c.name)), label: synthesizePhone(hashSeed(c.customerId || c.name)) },
  // Matches `buildCustomerInfoFields`'s own synthesized "Email" fallback
  // exactly (same `splitCustomerName` + `${first}.${last}@example.com`
  // formula) — so Favorites' "Enter phone, email or search term" search
  // (`contactMatchesSearch`, create-new.tsx) can actually match a
  // customer's email, and it agrees with what the Customer Information
  // panel already shows for that same customer. `splitCustomerName` is a
  // `function` declaration further down this file, hoisted, so it's
  // callable up here despite being defined later.
  email: (() => {
    const { firstName, lastName } = splitCustomerName(c.name);
    return `${firstName.toLowerCase()}.${lastName.toLowerCase()}@example.com`;
  })(),
  // See `OUTBOUND_AGENTS`'s own identical `categoryIcon`/`typeIcon` comments
  // above.
  categoryIcon: initialsAvatar(initialsFor(c.name), c.avatarClassName),
  typeIcon: customerCategoryIcon(),
}));

/** One `CreateNewOutboundContact` for a single hand-authored `CONTACT_HISTORY`
 *  row (agent-next-gen-contact-history.tsx), registered under `id` — see
 *  `CONTACT_HISTORY_OUTBOUND_CONTACTS`'s own doc comment below for why `id`
 *  is a parameter here rather than derived from `entry` directly. Same
 *  `initialsFor`/`synthesizePhone(hashSeed(...))`/`splitCustomerName`
 *  formulas `OUTBOUND_CUSTOMERS` above already uses, keyed off `entry.caseId`
 *  — the same value `handleReopenContactHistoryEntry`/`handleRedial`
 *  (AgentNextGenPage.tsx) set as the resulting card's own `recordId`, so a
 *  synthesized phone/email here agrees with `buildCustomerInfoFields`'s own
 *  synthesis for that same card (both key off the same seed). */
function contactHistoryOutboundContact(entry: ContactHistoryEntry, id: string): CreateNewOutboundContact {
  const { firstName, lastName } = splitCustomerName(entry.name);
  // Per follow-up request, randomized (not one hardcoded shade for every
  // entry) — deterministic off `entry.caseId`, same `randomAvatarClassName`
  // rotation the rest of this file uses for records with no fixture-
  // provided `avatarClassName` of their own.
  const avatarClassName = randomAvatarClassName(entry.caseId);
  return {
    id,
    name: entry.name,
    initials: initialsFor(entry.name),
    subtitle: entry.caseId,
    avatarClassName,
    channels: entry.channels ?? [],
    primaryPhone: {
      value: synthesizePhone(hashSeed(entry.caseId)),
      label: synthesizePhone(hashSeed(entry.caseId)),
    },
    email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@example.com`,
    // Every `ContactHistoryEntry` represents a past CUSTOMER contact — see
    // `OUTBOUND_AGENTS`'s own identical `categoryIcon`/`typeIcon` comments
    // above.
    categoryIcon: initialsAvatar(initialsFor(entry.name), avatarClassName),
    typeIcon: customerCategoryIcon(),
  };
}

/** Registers a `CreateNewOutboundContact` for every entry in `entries`, so
 *  `useAddChannelButton`'s `contactsById` lookup (create-new.tsx) has
 *  something to find once one of them is reopened/redialed into a real
 *  assignment card — per explicit request: a `ContactHistoryEntry` with no
 *  real backing `CREATE_NEW_CUSTOMERS` record (the 5 hand-authored
 *  `CONTACT_HISTORY` rows, and any dismissed interaction that wasn't itself
 *  already `CREATE_NEW_CUSTOMERS`-backed — see `ContactHistoryEntry.
 *  customerId`'s own doc comment) has its reopened/redialed card's id fall
 *  back to a synthetic `history:${id}`/`redial:${id}` one
 *  (`handleReopenContactHistoryEntry`/`handleRedial`, AgentNextGenPage.tsx/
 *  AgentWorkspace2WithDeskPage.tsx) that, before this, matched nothing in
 *  `contactsById` at all — `getAvailableChannels`/`getHeaderAction` always
 *  came back empty for them, so the record header's own "+" (Add Channel)
 *  row silently showed nothing even for a customer with other channels
 *  genuinely on file (`entry.channels`). Confirmed via screenshot as a
 *  genuinely repeatable bug, not just a one-off for the 5 original rows: a
 *  freshly dismissed interaction gets logged as its own brand-new
 *  `ContactHistoryEntry` (`buildDismissedContactHistoryEntry`) with a fresh
 *  `id`, so reopening THAT row hit the exact same "nothing registered under
 *  this synthetic id" gap all over again — every call site now runs this
 *  over `dismissedContactHistory` too (state, so it has to be recomputed
 *  live, unlike `CONTACT_HISTORY_OUTBOUND_CONTACTS` below), not just the 5
 *  static rows, so newly-dismissed customers get the exact same treatment
 *  going forward instead of only the ones hand-authored ahead of time.
 *
 *  Every entry registered here is meant to sit in its OWN hidden group
 *  alongside `outboundConfig`'s real groups — same "findable via
 *  `contactsById` but not through the New Outbound picker's own group
 *  dropdown" treatment "Dial Pad" already gets, since these aren't real,
 *  dialable directory contacts an agent should be able to search up and
 *  call cold.
 *
 *  Since P0.5b.2 a redialed or reopened Contact History card carries one
 *  entity id per case, `history:${caseId}` (`historyEntityId`,
 *  src/contact-handling/contact-identity.ts), whichever button opened it —
 *  so each case is registered once, under that id. */
export function buildContactHistoryOutboundContacts(
  entries: ContactHistoryEntry[]
): NonNullable<CreateNewOutboundConfig["groups"][number]["contacts"]> {
  const seen = new Set<string>();
  return entries.flatMap((entry) => {
    const id = `history:${entry.caseId}`;
    if (seen.has(id)) return [];
    seen.add(id);
    return [contactHistoryOutboundContact(entry, id)];
  });
}

/** The 5 hand-authored `CONTACT_HISTORY` rows' own contacts — static, since
 *  `CONTACT_HISTORY` itself never changes at runtime (unlike
 *  `dismissedContactHistory`, which every page's own `contactHistoryOutboundContacts`
 *  memo re-derives live via `buildContactHistoryOutboundContacts` above). */
export const CONTACT_HISTORY_OUTBOUND_CONTACTS: NonNullable<CreateNewOutboundConfig["groups"][number]["contacts"]> =
  buildContactHistoryOutboundContacts(CONTACT_HISTORY);

export const OUTBOUND_TEAMS: NonNullable<CreateNewOutboundConfig["groups"][number]["contacts"]> = [
  // See `OUTBOUND_AGENTS`'s own identical `categoryIcon` comment above.
  { id: "t1", name: "Billing Support",    initials: "BS", subtitle: "TEAM-04", avatarClassName: "bg-lyra-accent-purple-soft text-lyra-accent-purple-strong", channels: ["voice", "email"], categoryIcon: initialsAvatar("BS", "bg-lyra-accent-purple-soft text-lyra-accent-purple-strong"), typeIcon: teamCategoryIcon() },
  { id: "t2", name: "Tier 2 Escalations", initials: "T2", subtitle: "TEAM-07", avatarClassName: "bg-lyra-accent-red-soft text-lyra-accent-red-strong",       channels: ["voice", "email"], categoryIcon: initialsAvatar("T2", "bg-lyra-accent-red-soft text-lyra-accent-red-strong"), typeIcon: teamCategoryIcon() },
];

// Deterministic (no Math.random) per-team agent roster for the Teams
// group's own "Choose team" sub-picker (see `CreateNewOutboundGroup.
// subFilter`'s own doc comment in create-new.tsx, and the "teams" group
// wiring in `outboundConfig` below) — per explicit request: picking a team
// there should let the agent search that team's real members. Round-robins
// `OUTBOUND_AGENTS` across `OUTBOUND_TEAMS` by index (no dedicated
// "team" field exists on `CreateNewAgentRecord`/`CREATE_NEW_AGENTS`), so
// each team gets a stable, real-looking set of members instead of an
// arbitrary or empty one.
export const OUTBOUND_TEAM_MEMBERS: Record<string, NonNullable<CreateNewOutboundConfig["groups"][number]["contacts"]>> =
  Object.fromEntries(
    OUTBOUND_TEAMS.map((team: any, teamIndex: number) => [
      team.id,
      OUTBOUND_AGENTS.filter((_agent: any, agentIndex: number) => agentIndex % OUTBOUND_TEAMS.length === teamIndex),
    ])
  );

export const OUTBOUND_SKILLS: NonNullable<CreateNewOutboundConfig["groups"][number]["contacts"]> = [
  // See `OUTBOUND_AGENTS`'s own identical `categoryIcon`/`quickLaunch`
  // comments above — a skill queue has no real per-contact address to
  // choose either, so it gets the same immediate-launch treatment.
  { id: "s1", name: "Spanish Language",  initials: "ES", subtitle: "SKL-12", avatarClassName: "bg-lyra-accent-green-soft text-lyra-accent-green-strong", channels: ["voice", "email"], status: "available", queueCount: 4, waitTimeSeconds: 200, categoryIcon: initialsAvatar("ES", "bg-lyra-accent-green-soft text-lyra-accent-green-strong"), typeIcon: skillCategoryIcon(), quickLaunch: true },
  { id: "s2", name: "Technical Support", initials: "TS", subtitle: "SKL-03", avatarClassName: "bg-lyra-accent-blue-soft text-lyra-accent-blue-strong",   channels: ["voice", "email"], status: "busy",      queueCount: 7, waitTimeSeconds: 95, categoryIcon: initialsAvatar("TS", "bg-lyra-accent-blue-soft text-lyra-accent-blue-strong"), typeIcon: skillCategoryIcon(), quickLaunch: true },
];

// Every group the "New Outbound" flow could show ("hide it, don't destroy
// it"): the launcher picks which ones it renders from its tabs (Settings →
// New Outbound, `launcherGroups`); the definitions all stay here.
export const OUTBOUND_GROUPS: CreateNewOutboundConfig["groups"] = [
  // No dedicated "Favorites" entry in the group dropdown, per explicit
  // request — this "all" entry replaces it as the DEFAULT/starting
  // filter instead (`defaultGroupId` below) rather than sitting beside
  // it as a separate option. Still uses `kind: "favorites"` under the
  // hood (create-new.tsx's own behavior for that kind is exactly what's
  // wanted here: idle state shows only starred contacts, and typing a
  // search widens to every contact across every group — see
  // `activeGroupContacts`'s own doc comment there), just labeled/keyed
  // as "All" instead of "Favorites" since that's the only way an agent
  // reaches this view now.
  // `emptyMessage` per explicit request — plain "Search above to find a
  // contact" once nothing's favorited yet, no "No favorites yet —"
  // prefix (that phrasing read like an error/apology for something
  // missing, when the real point is just "type to search").
  // Per a later explicit request, Dial Pad is now the FIRST row in this
  // list (it used to sit last, reachable only via its own separate ghost
  // button below the list — see that entry's own doc comment for how
  // that changed) — moved here in `OUTBOUND_GROUPS` itself, not
  // special-cased in create-new.tsx, since that component already
  // renders every entry in whatever order `outbound.groups` defines,
  // Dial Pad included now that it's just another row.
  { id: "dialpad", label: "Dial Pad", kind: "dialpad", icon: dialpadCategoryIcon() },
  // Per a later explicit request (the "Choose group" `Select` was
  // replaced with an always-visible list of rows, lyra-ui's create-new.tsx
  // — see that list's own doc comment), this entry's label is "Favorites"
  // again, matching the reference mockup's own top row exactly — with a
  // real list of rows to read top-to-bottom, a plain "All" no longer makes
  // sense as a label sitting alongside "Agents"/"Skills"/etc. `id`/`kind`/
  // `defaultGroupId` (below) are unchanged, so this is still the DEFAULT/
  // starting filter, just relabeled.
  { id: "all", label: "Favorites", kind: "favorites", emptyMessage: "Search above to find a contact", icon: favoritesCategoryIcon() },
  // Per explicit request: each group below gets a leading icon in the
  // group list (`CreateNewOutboundGroup.icon`, lyra-ui's create-new.tsx),
  // matched to what that group represents — a headset for Agents
  // (support), a share/network glyph for Skills, a people-group for My
  // Team. `h-4 w-4` here is purely defensive/self-documenting — that list's
  // own icon slot already forces every option icon to that size regardless
  // of what's authored on the element itself. Reordered per the reference
  // mockup: Skills now comes before "My Team" (previously "Teams," see
  // that entry's own doc comment), which used to sit right after Agents.
  { id: "agents", label: "Agents", contacts: OUTBOUND_AGENTS, icon: agentCategoryIcon() },
  { id: "skills", label: "Skills", contacts: OUTBOUND_SKILLS, icon: skillCategoryIcon() },
  // Relabeled "Teams" → "My Team" per the reference mockup — `id`
  // deliberately left as `"teams"` (not renamed to match) since the Teams
  // group picker/member-roster wiring elsewhere in this app
  // (AgentNextGenPage.tsx et al.) already keys off this exact id; renaming
  // it here would silently break that wiring for a label-only request.
  { id: "teams", label: "My Team", contacts: OUTBOUND_TEAMS, icon: teamCategoryIcon() },
  // Partner Network, Vendor Directory and Regional Offices are address
  // books now, entries of the one Address Book group (`ADDRESS_BOOKS`,
  // below; P0.5d.2), not groups of their own.
  // Shown as the launcher's "All" tab (CXone's Directory App "All"), when on.
  { id: "customers", label: "Customers", contacts: OUTBOUND_CUSTOMERS, icon: customerCategoryIcon() },
];

// Which groups the New Outbound launcher shows is decided by its tabs
// (Settings → New Outbound, `launcherGroups` in src/contact-handling), not
// here. `OUTBOUND_CONFIG.groups` keeps every group, Customers included:
// the add-channel "+" builds its contact lookup from it, and without
// Customers a known customer's "+" fell back to the ad-hoc input.

export const OUTBOUND_CONFIG: CreateNewOutboundConfig = {
  outboundTitle: "New Outbound",
  groups: OUTBOUND_GROUPS,
  // "all" (not "agents") — per explicit request, the New Outbound picker
  // now opens on the "All" filter (favorited contacts idle, full-database
  // search once typed) by default instead of Agents.
  defaultGroupId: "all",
  // One label for the whole flow, not per-group — per explicit
  // request/confirmed UX bug: search matches name/subtitle/phone/email
  // identically no matter which group filter is selected, so text that
  // changed per group (e.g. "Search Agents") falsely implied switching
  // the filter changed what the box searched for. Rendered as a real
  // `<label>` above the field, not placeholder text, per a further
  // explicit follow-up. See `CreateNewOutboundConfig.searchLabel`'s own
  // doc comment in create-new.tsx.
  searchLabel: "Enter phone, email or search term",
  // Per a later explicit request ("display all of the agents when
  // agents list item is clicked ... paginate ... filter as the agent
  // searches"), the real list is ready now — idle browsing into a
  // contacts-kind group (Agents/Skills/My Team/Customers) shows that
  // group's FULL roster with its own pagination footer, not just
  // already-favorited contacts. "Favorites" itself is unaffected either
  // way — it's a distinct `kind` create-new.tsx's `activeGroupContacts`
  // never gates on this flag (see that const's own doc comment): idle
  // Favorites always shows only starred contacts, searching from it
  // always searches every group, in both states of this flag.
  hideContactList: false,
  channelOptions: [
    { id: "voice",    label: "Call",     selectLabel: "Voice", icon: <Phone       className="h-5 w-5" strokeWidth={1.5} /> },
    // Per explicit request: agents' only other reachable channel besides
    // Voice — `MessageCircle`, matching `ChatChannelRow`/`CHANNEL_TYPE_META.
    // chat`'s own icon (lyra-ui channel-row.tsx) for the same channel type,
    // same reasoning `WhatsAppIcon`'s own swap-in above already documents.
    // No contact in any OTHER group lists "chat" among its own `channels`
    // (only `OUTBOUND_AGENTS`, above, does), so this option only ever
    // surfaces for an agent contact.
    { id: "chat",     label: "Chat",                           icon: <MessageCircle className="h-5 w-5" strokeWidth={1.5} /> },
    { id: "email",    label: "Email",                          icon: <Mail        className="h-5 w-5" strokeWidth={1.5} /> },
    { id: "sms",      label: "SMS",                            icon: <MessageSquare className="h-5 w-5" strokeWidth={1.5} /> },
    // `WhatsAppIcon` (lyra-ui's own real brand glyph, channel-row.tsx) — was
    // the generic Lucide `MessageCircle` bubble, a real mismatch confirmed
    // via screenshot: this channel's own icon here (the record header's
    // per-channel "Add Channel" buttons, and the "Select Channel" list, both
    // read their icon from this array) didn't match the one
    // `WhatsAppChannelRow`/`CHANNEL_TYPE_META.whatsapp` already used
    // everywhere else (the LeftNav's own channel chips, the record-header
    // tabs) for the exact same channel.
    // WhatsApp reaches a phone number (lyra `addressKind`), so its address
    // field is "Select Phone" and a typed number works for it.
    { id: "whatsapp", label: "WhatsApp", addressKind: "phone", icon: <WhatsAppIcon className="h-5 w-5" /> },
  ],
  // What a typed address offers through "Continue with" (lyra
  // `adHocChannels`); the page narrows it to Settings → Channels and
  // Outbound Calling → Ad-hoc.
  adHocChannels: { phone: ["voice", "sms", "whatsapp"], email: ["email"] },
  phoneOptions: [
    { value: "+14563833329", label: "(456) 383-3329" },
    { value: "+14565559981", label: "(456) 555-9981" },
    { value: "+14565550147", label: "(456) 555-0147" },
  ],
  skillOptions: [
    { value: "general", label: "General Support" },
    { value: "technical", label: "Technical Support" },
    { value: "billing", label: "Billing" },
    { value: "sales", label: "Sales" },
    { value: "escalations", label: "Escalations" },
    { value: "vip", label: "VIP Support" },
  ],
  onQuickDial: (phoneNumber) => {
    // eslint-disable-next-line no-console
    console.log("Quick dial:", phoneNumber);
  },
  onStartCall: (selection) => {
    // eslint-disable-next-line no-console
    console.log(
      "Start call:",
      selection.channel,
      "→",
      selection.contact.name,
      `(phone: ${selection.phone}, skill: ${selection.skillId})`
    );
  },
  pageSize: 10,
};
