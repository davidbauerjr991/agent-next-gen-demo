// CustomersListView (Dashboard tab row's "Customers" tab) + its channel
// picker/cell components — see agent-next-gen-shared-utils.ts and sibling
// agent-next-gen-*.ts(x) files for everything AgentNextGenPage.tsx itself no
// longer declares — split out once that file crossed Babel's 500KB
// code-generator threshold.
import React, { useState, useEffect } from "react";
import {
  type ChannelType,
  type CreateNewOutboundContact,
  Popover,
  RadioButtonGroup,
  CHANNEL_TYPE_META as CHANNEL_ICON_META,
  Select,
  Button,
  ActionIconButton,
  type FilterChipOption,
  type SortDirection,
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
  type MenuEntry,
  KebabMenuButton,
} from "@nicecxone/lyra-ui";
import { CREATE_NEW_CUSTOMERS, type CreateNewCustomerRecord } from "@nicecxone/lyra-ui/customers-data";
import { OUTBOUND_CONFIG, OUTBOUND_CUSTOMERS } from "@/components/agent-next-gen-outbound-data";
import { type ContactInteraction } from "@/components/agent-next-gen-interaction-dashboard";
import { CURRENT_AGENT_NAME, nextInteractionSortDirection } from "@/components/agent-next-gen-shared-utils";
import { CHANNEL_TYPE_ICON_COLOR_CLASS } from "@/components/agent-next-gen-contact-history";
import { cn } from "@/lib/utils";
import { useSettings, type ContactChannel } from "@/settings";
import {
  Plus,
  RefreshCw,
  Trash2,
  PhoneOutgoing,
  RotateCcw,
  UserPlus,
  UserRound,
  Mail,
  Phone,
  MessageCircle,
  ArrowDown,
  ArrowUp,
  Eye,
} from "lucide-react";

/* ── CustomersListView ──
   Contacts list view populating the Dashboard tab row's "Customers" tab
   (`activeDeskTab === "customers"`, see the render branch below). Row
   data now comes from lyra-ui's own shared `CREATE_NEW_CUSTOMERS` fixture
   (`@nicecxone/lyra-ui/customers-data`, already imported above for the
   Outbound picker) instead of a hand-transcribed screenshot table, so
   this list view can't drift out of sync with lyra-ui's "customer
   database" — see create-new-customers-data.ts, which now carries
   firstName/lastName/group/firstPhone/emailAddress/address1/city/state/
   postalCode fields (added alongside its pre-existing id/name/customerId/
   channels/avatarClassName) specifically so this table has real columns
   to render.

   The UI itself is a direct, trimmed port of lyra-ui's own "Data
   Management" template (DataManagement.stories.tsx's
   `DataManagementTemplate`) — same state shape (`sortKey`/`sortDir`/
   `handleSort`/`dirFor`, `useColumnReorder`, `visibleCols`/
   `ColumnToggle`, `filterValues`/`filterDefs`, row-selection
   `Checkbox`es, real `currentPage`/`rowsPerPage`-driven pagination),
   same `columnConfig: Record<Key, {label, flex}>` shape (proportional
   `flex-[n]` ratios, no per-column `min-w-[…]` floor — that floor is
   what made the table wider than its container earlier), same render
   shape (`TableToolbar` → `Table` → `TableFooter`). Left out: the
   template's own `PageHeader`/`SidePanel`/`TabList`/grouping/auto-fit —
   this embeds inside `AgentNextGenPage`'s own PageHeader/tab row, which
   already cover that job, and grouping/auto-fit weren't asked for. */

export interface CustomerListRecord {
  contactNumber: string;
  /** Which channels this customer can be reached on — same field lyra-ui's
   *  Outbound picker already uses for its own per-row hover flyout (see
   *  create-new-customers-data.ts). Rendered here as hover-reveal
   *  `ActionIconButton`s instead of a Menu flyout — see
   *  `CustomerChannelCell` below. */
  channels: ChannelType[];
  firstName: string;
  lastName: string;
  group: string;
  firstPhone: string;
  emailAddress: string;
  address1: string;
  city: string;
  state: string;
  postalCode: string;
  originalCustomerId: string;
  dateOfBirth: string;
  agent: string;
  agentTeam: string;
  paymentBalance: string;
}

// Mapped 1:1 from lyra-ui's `CREATE_NEW_CUSTOMERS` — `customerId` (e.g.
// "CST-10000") becomes this table's "Contact Number" column, everything
// else is a passthrough of the matching field already on that record.
export const CUSTOMER_LIST_RECORDS: CustomerListRecord[] = CREATE_NEW_CUSTOMERS.map((c: CreateNewCustomerRecord) => ({
  contactNumber: c.customerId,
  channels: c.channels,
  firstName: c.firstName,
  lastName: c.lastName,
  group: c.group,
  firstPhone: c.firstPhone,
  emailAddress: c.emailAddress,
  address1: c.address1,
  city: c.city,
  state: c.state,
  postalCode: c.postalCode,
  originalCustomerId: c.originalCustomerId,
  dateOfBirth: c.dateOfBirth,
  agent: c.agent,
  agentTeam: c.agentTeam,
  paymentBalance: c.paymentBalance,
}));

// The table's actual rendered columns — deliberately NOT `keyof
// CustomerListRecord` (`CUSTOMER_COLUMN_CONFIG` below is a per-COLUMN
// config, one entry per key here, and needs to stay exhaustive over
// exactly this set). originalCustomerId/dateOfBirth/agent/agentTeam/
// paymentBalance are real `CustomerListRecord` fields but intentionally
// filter-only, not columns — see `CustomerFilterKey` below, which does
// cover them.
export type CustomerColKey =
  | "contactNumber"
  | "channels"
  | "firstName"
  | "lastName"
  | "group"
  | "firstPhone"
  | "emailAddress"
  | "address1"
  | "city"
  | "state"
  | "postalCode";
/** Every filterable string field on `CustomerListRecord` — everything
 *  except `channels` (a `ChannelType[]`, not a plain string value a
 *  checkbox-style `FilterChip` can compare against). Wider than
 *  `CustomerColKey` on purpose: the "+ Filter" menu can filter on fields
 *  (e.g. Original customer ID, Date of birth, Agent, Agent team, Payment
 *  balance) that aren't rendered as their own table column. */
export type CustomerFilterKey = Exclude<keyof CustomerListRecord, "channels">;

// Fixed left-to-right channel order the hover flyout renders in — only
// channels the row's own `channels` array actually includes are shown
// ("only supported channels show", same rule as the Outbound picker).
export const CUSTOMER_CHANNEL_ORDER: ChannelType[] = ["voice", "sms", "email", "whatsapp"];

/** Which field the launch popover's address dropdown shows for a given
 *  channel — email uses the row's `emailAddress`, voice/sms use its
 *  `firstPhone`, WhatsApp uses a synthesized `@FirstName LastName` handle
 *  (see below) rather than either of those. This dataset only carries one
 *  number/address per customer (unlike the full Outbound picker's
 *  `resolveOutboundDetailField`, which juggles several candidate numbers),
 *  so there's just one option to offer either way.
 *
 *  WhatsApp used to fall into the same `firstPhone` branch as voice/sms —
 *  a real, confirmed bug: this table's own database (`CREATE_NEW_CUSTOMERS`,
 *  `create-new-customers-data.ts`) has no `whatsappHandle`-style field to
 *  read a real one from, so the launch popover's "Select Phone" field
 *  listed this row's plain phone number (and, via `addressOptionsForChannel`
 *  below, the same shared `OUTBOUND_CONFIG.phoneOptions` pool every OTHER
 *  phone-based channel offers) for a channel that isn't actually reached by
 *  phone number at all. `@${row.firstName} ${row.lastName}` mirrors the
 *  exact synthesis lyra-ui's own `resolveOutboundDetailField` already uses
 *  for the real "New Outbound" launch flow (`create-new.tsx`,
 *  `channel === "whatsapp"` branch: `` `@${contact.name}` `` — the same
 *  "no real per-contact handle field exists yet" gap that function's own
 *  doc comment documents) so this table's picker maps to the exact same
 *  handle the rest of the app would derive for this same customer, instead
 *  of a second, disconnected value. */
export function customerChannelAddress(row: CustomerListRecord, channel: ChannelType): { label: string; value: string } {
  if (channel === "email") return { label: "Select Email Address", value: row.emailAddress };
  if (channel === "whatsapp") return { label: "Select WhatsApp Handle", value: `@${row.firstName} ${row.lastName}` };
  return { label: "Select Phone", value: row.firstPhone };
}

/** Every known address this row can be reached at for a given channel —
 *  the row's own number/email/handle first (same value
 *  `customerChannelAddress` returns), then, for PHONE-based channels only
 *  (voice/sms — NOT WhatsApp, see below), the same shared fallback pool
 *  (`OUTBOUND_CONFIG.phoneOptions`) already offered everywhere else a phone
 *  number needs to be picked (e.g. the `CreateNew` outbound picker's own
 *  "Select Phone" screen) — deduped so the row's own number isn't listed
 *  twice if it happens to coincide with a pool entry. Without this, a
 *  channel type already open on its ONE known number read as fully
 *  exhausted here even though the very same contact still has other real
 *  numbers reachable elsewhere in the app (caught from a screenshot of
 *  Sarah Miller's SMS icon disappearing entirely despite her own "Add
 *  Channel" picker still listing 3 more unused numbers). Email and
 *  WhatsApp both have no such shared pool — a customer only ever has the
 *  one address/handle on file for either (WhatsApp's is synthesized, see
 *  `customerChannelAddress`'s own doc comment, but is still just the one
 *  value) — `OUTBOUND_CONFIG.phoneOptions` is a pool of raw PHONE numbers
 *  specifically, and mixing WhatsApp's own handle-shaped value into that
 *  pool (its pre-existing behavior) offered actual phone numbers as
 *  "WhatsApp handles," which was the bug this whole function got rewritten
 *  to fix. */
export function addressOptionsForChannel(row: CustomerListRecord, channel: ChannelType): { value: string; label: string }[] {
  const own = customerChannelAddress(row, channel);
  const options = own.value ? [{ value: own.value, label: own.value }] : [];
  if (channel === "email" || channel === "whatsapp") return options;
  for (const opt of OUTBOUND_CONFIG.phoneOptions) {
    if (!options.some((o) => o.value === opt.value)) options.push(opt);
  }
  return options;
}

/** Shared "Select Channel / Select Phone (or Email) / Outbound Skill /
 *  Start Interaction" popover body — same shape as lyra-ui's own
 *  `AddChannelButton` (create-new.tsx), composed here from the same
 *  primitives (`Popover`/`RadioButtonGroup`/`Select`/`Button`) rather than
 *  imported directly, since `AddChannelButton`'s own trigger is a fixed
 *  "+" icon it can't swap out. Extracted into its own component (rather
 *  than living inline in `CustomerChannelPopoverButton`) so both that
 *  per-channel-icon trigger AND `CustomerAddChannelButton`'s single
 *  generic header trigger can share one copy of this form instead of
 *  each hand-rolling their own. Reuses `OUTBOUND_CONFIG.skillOptions` so
 *  the skill list can't drift from the real Outbound picker's own list.
 *  `placement="bottom"` is only a preferred side — `Popover`'s underlying
 *  Radix collision detection (`avoidCollisions`, see popover.tsx) flips it
 *  above the trigger automatically when there isn't room below. */
/** A row's channels in display order, only the ones Settings → Channels has
 *  on (hidden, not disabled). Every channel action on a customer (the table's
 *  hover icons, the row panel's and full-screen tab's "+") reads this. */
function useRowChannels(row: CustomerListRecord | null): ChannelType[] {
  const [channels] = useSettings("channels");
  return row ? CUSTOMER_CHANNEL_ORDER.filter((c) => row.channels.includes(c) && (channels[c as ContactChannel] ?? true)) : [];
}

export function CustomerChannelPicker({
  row,
  defaultChannel,
  available,
  openAddresses = {},
  onStartInteraction,
  trigger,
  open,
  onOpenChange,
}: {
  row: CustomerListRecord;
  /** Which channel the form starts on when opened — the clicked icon's own
   *  channel for `CustomerChannelPopoverButton`, or simply `available[0]`
   *  for `CustomerAddChannelButton`'s single generic trigger. */
  defaultChannel: ChannelType;
  available: ChannelType[];
  /** Address values already open on THIS interaction, keyed by channel
   *  type — subtracted from `addressOptionsForChannel`'s full pool so an
   *  agent can't pick a number/address that's already an open channel
   *  (would just duplicate it) while still seeing/picking any other real
   *  one that isn't. Omitted entirely by `CustomerChannelCell`'s Customers-
   *  table usage, where there's no active interaction to already have
   *  channels open against — defaults to `{}` (nothing excluded) there. */
  openAddresses?: Partial<Record<ChannelType, string[]>>;
  onStartInteraction: (contact: CreateNewOutboundContact, channel: ChannelType, phone: string, skillId: string) => void;
  trigger: React.ReactElement;
  /** Open state lives in whichever wrapper renders `trigger` (not in here),
   *  so that wrapper's own `aria-expanded`/hover-fade styling reads the
   *  exact same real open state `Popover` itself uses, instead of each
   *  keeping its own disconnected copy. */
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [selectedChannel, setSelectedChannel] = useState<ChannelType>(defaultChannel);
  const [address, setAddress] = useState("");
  // Defaults to the FIRST skill in `OUTBOUND_CONFIG.skillOptions`, not `""`
  // — same "default to the first skill so the agent can immediately start
  // the interaction without having to choose" fix already applied to
  // `AddChannelButton`/`CreateNew` (create-new.tsx) for the New Outbound
  // flow, extended here to this Customers-table channel picker per explicit
  // follow-up request. `?? ""` only matters if `skillOptions` were ever
  // empty, which preserves the existing disabled-button guard below.
  const [skillId, setSkillId] = useState(OUTBOUND_CONFIG.skillOptions[0]?.value ?? "");

  // Every real address for a channel MINUS whichever of those are already
  // open on this interaction — see `openAddresses`'s own doc comment above.
  // An empty result means this channel is genuinely exhausted (every known
  // number/address for it is already an open channel), not merely that one
  // particular number happens to be taken.
  const remainingOptionsFor = (channel: ChannelType) =>
    addressOptionsForChannel(row, channel).filter((o) => !(openAddresses[channel] ?? []).includes(o.value));

  // Re-derive every time this popover opens (not just on first mount) —
  // same "only once actually open" timing `AddChannelButton` uses (see its
  // own effect comments), and for the same reason: this popover instance is
  // reused across every open of its trigger, so a stale channel/skill from
  // a previous open needs to be overwritten before the fields render again.
  useEffect(() => {
    if (!open) return;
    setSelectedChannel(defaultChannel);
    // Back to the first skill, not `""` — see this state's own initializer
    // above.
    setSkillId(OUTBOUND_CONFIG.skillOptions[0]?.value ?? "");
  }, [open, defaultChannel]);

  useEffect(() => {
    if (!open) return;
    setAddress(remainingOptionsFor(selectedChannel)[0]?.value ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, selectedChannel, row, openAddresses]);

  const fieldMeta = customerChannelAddress(row, selectedChannel);
  const remainingOptions = remainingOptionsFor(selectedChannel);
  // No real, still-unused phone/email left for this channel — true both
  // for a customer record with a blank `firstPhone`/`emailAddress` on file
  // AND for a real row whose only known number(s) are already open as other
  // channels on this same interaction. Gates the address field and Start
  // Interaction button below so an agent can't select a channel that looks
  // available but has nothing real (or nothing UNUSED) behind it and
  // silently no-ops on click — see this component's own
  // `handleStartInteraction` guard, which already fails the same way but
  // with no visible signal.
  const hasAddress = remainingOptions.length > 0;

  const handleStartInteraction = () => {
    if (!skillId || !hasAddress) return;
    // `OUTBOUND_CUSTOMERS` is built 1:1 (same order, same underlying
    // record) from the exact same `CREATE_NEW_CUSTOMERS` fixture
    // `CUSTOMER_LIST_RECORDS` maps into `row` from — its `subtitle` field
    // is that customer's `customerId`, i.e. exactly this row's own
    // `contactNumber` (see `CUSTOMER_LIST_RECORDS`'s own mapping comment
    // above) — so this reliably finds the matching `CreateNewOutboundContact`
    // `handleStartCall` needs, without this table needing its own parallel
    // copy of that lookup/contact-shape logic.
    const contact = OUTBOUND_CUSTOMERS.find((c: CreateNewOutboundContact) => c.subtitle === row.contactNumber);
    if (!contact) return;
    onStartInteraction(contact, selectedChannel, address, skillId);
    onOpenChange(false);
  };

  return (
    <Popover
      open={open}
      onOpenChange={onOpenChange}
      placement="bottom"
      sideOffset={4}
      showArrow={false}
      onOpenAutoFocus={(e: Event) => e.preventDefault()}
      className="w-64"
      bodyPadding={false}
      content={
        // `onClick` stopPropagation below — this content renders through a
        // Radix portal (outside the row's DOM subtree), but React bubbles
        // portal events along the *React* tree, not the DOM tree, so a
        // click anywhere in here (a radio option, a Select option — even
        // though `Select`'s own listbox is a further-nested portal, it's
        // still a React descendant of this div) would otherwise keep
        // bubbling up through `CustomerChannelPopoverButton` into the
        // `TableRow`'s own `onClick`, toggling the Customer Information
        // panel open/closed on every field interaction. The trigger icon
        // already stops propagation on itself (see
        // `CustomerChannelPopoverButton`) for the same reason, but that
        // only covers the click that opens the popover, not clicks made
        // once it's open.
        <div className="w-64 p-3 space-y-3" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
          {/* One channel available (Settings → Channels): no channel step. */}
          {available.length > 1 && (
          <RadioButtonGroup
            label="Select Channel"
            // Disables (rather than hides) whichever channel options have
            // no real, still-unused phone/email left for this row — same
            // `remainingOptionsFor` lookup the address Select below uses.
            // Kept selectable-looking-but-blocked instead of removed from
            // the list entirely so the agent can still see every channel
            // type this contact is nominally reachable on, just not
            // proceed past it once every real address for that type is
            // either unknown or already open elsewhere on this interaction
            // — the Select/Start Interaction gating below (`hasAddress`)
            // is the same signal, just surfaced one step earlier.
            options={available.map((c) => ({
              value: c,
              label: CHANNEL_ICON_META[c].label,
              disabled: remainingOptionsFor(c).length === 0,
            }))}
            value={selectedChannel}
            onValueChange={(v: string) => setSelectedChannel(v as ChannelType)}
          />
          )}
          <Select
            label={fieldMeta.label}
            value={hasAddress ? address || undefined : undefined}
            onValueChange={setAddress}
            disabled={!hasAddress}
            placeholder={
              hasAddress
                ? undefined
                : `No ${
                    selectedChannel === "email"
                      ? "email address"
                      : selectedChannel === "whatsapp"
                      ? "WhatsApp handle"
                      : "unused phone number"
                  } available`
            }
            options={remainingOptions}
          />
          <Select
            label="Outbound Skill"
            placeholder="Select Outbound Skill"
            value={skillId || undefined}
            onValueChange={setSkillId}
            options={OUTBOUND_CONFIG.skillOptions}
          />
          <Button
            variant="default"
            size="lg"
            className="w-full"
            disabled={!skillId || !hasAddress}
            onClick={handleStartInteraction}
          >
            Start Interaction
          </Button>
        </div>
      }
    >
      {trigger}
    </Popover>
  );
}

/** One hover-reveal channel icon in a Customers row — thin wrapper around
 *  `CustomerChannelPicker`, anchored to whichever icon was actually
 *  clicked and defaulted to that icon's own channel (unlike
 *  `CustomerAddChannelButton`'s single generic trigger). Also reused (via
 *  `alwaysVisible`/`outlined` below) as `CustomerRowInfoPanel`'s own
 *  per-channel header buttons once its header has room for one-per-channel
 *  instead of a single combined trigger — see that component's own doc
 *  comment. */
export function CustomerChannelPopoverButton({
  row,
  channel,
  available,
  onStartInteraction,
  alwaysVisible = false,
  overlay = false,
  size = "sm",
}: {
  row: CustomerListRecord;
  channel: ChannelType;
  available: ChannelType[];
  onStartInteraction: (contact: CreateNewOutboundContact, channel: ChannelType, phone: string, skillId: string) => void;
  /** Skips the default hover/focus-reveal fade (opacity-0 until the parent
   *  row is hovered/focused) in favor of a permanently visible, outlined
   *  look — `border-lyra-border-soft`/`bg-lyra-bg-control`/
   *  `text-lyra-fg-action`, the same "equally-weighted quick action"
   *  treatment the active-interaction record header's own per-channel
   *  buttons use (`AgentNextGenPage.tsx`'s own `getAvailableChannels`
   *  mapping). For `CustomerRowInfoPanel`'s header row (per explicit
   *  request) — there's no hovered/focused "row" context there the way a
   *  Customers table row provides, so the fade-until-hover treatment has
   *  nothing to key off and would just leave the icon permanently
   *  invisible. Default `false` (unchanged fade-reveal behavior) for the
   *  Customers table's own existing per-row usage. */
  alwaysVisible?: boolean;
  /** Renders as a plain, unbordered icon — no chip background, no ring,
   *  no per-icon fade of its own — meant for `CustomerChannelStack`'s
   *  hover-revealed leading overlay (see that component's own doc
   *  comment), where visibility and background are already handled by
   *  the *shared overlay strip* all these icons sit inside, not by each
   *  icon individually. Distinct from `alwaysVisible` (permanently
   *  visible bordered pill, used where there's no row to hover) and from
   *  the default (each icon fades in on its own row-hover) — this one
   *  is "always rendered as visible" from its OWN point of view (no
   *  opacity classes at all) because the icon never renders unless its
   *  parent overlay is already showing. */
  overlay?: boolean;
  /** Forwarded straight through to the inner `ActionIconButton`'s own
   *  `size` — per explicit request ("match the sizes of the channel
   *  buttons to the size of the edit button"), `CustomerAddChannelButton`'s
   *  wide-mode branch passes `"xs"` here (24px, matches lyra-ui `Button`
   *  `size="sm"`'s own height — see that component's own doc comment on
   *  its `xs` tier) so these icons line up with the Customer Overview
   *  card's `size="sm"` Edit button sitting in the same row. Defaults to
   *  `"sm"` (32px) — every other existing consumer (the Customers table's
   *  own per-row hover icons, `CustomerChannelStack`'s overlay) is
   *  unaffected. */
  size?: "xs" | "sm";
}) {
  const [open, setOpen] = useState(false);
  const meta = CHANNEL_ICON_META[channel];
  return (
    <CustomerChannelPicker
      row={row}
      defaultChannel={channel}
      available={available}
      onStartInteraction={onStartInteraction}
      open={open}
      onOpenChange={setOpen}
      trigger={
        <ActionIconButton
          size={size}
          title={meta.label}
          aria-expanded={open}
          onClick={(e: React.MouseEvent<HTMLButtonElement>) => e.stopPropagation()}
          className={cn(
            overlay
              ? "text-lyra-fg-action hover:bg-lyra-state-hover active:bg-lyra-state-pressed"
              : alwaysVisible
              ? "border border-lyra-border-soft bg-lyra-bg-control text-lyra-fg-action hover:bg-lyra-state-hover active:bg-lyra-state-pressed"
              : cn(
                  "transition-opacity",
                  // Stays visible/interactive whenever ITS OWN popover is
                  // open — moving the pointer off the row and into the
                  // popover's content (portalled outside the row, so
                  // `group-hover` alone would end) shouldn't fade the
                  // trigger out from under an open popover, same "force
                  // visible while open" rule the message-bubble Copy/
                  // Add-tag toolbar and its TagPicker popover already use
                  // elsewhere in this file.
                  !open &&
                    "pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100"
                )
          )}
        >
          {meta.icon}
        </ActionIconButton>
      }
    />
  );
}

/** Header channel action(s) for `CustomerRowInfoPanel` — per explicit
 *  request, now mirrors the active-interaction record header's own narrow/
 *  wide behavior (`AgentNextGenPage.tsx`'s `getAvailableChannels` mapping)
 *  instead of always being a single icon:
 *
 *  - `isNarrow` (docked, under `CustomerRowInfoPanel`'s own 480px
 *    `isNarrowActions` threshold): one always-visible, solid-primary "+"
 *    trigger (`Plus`, blue) opening the full channel picker defaulted to
 *    the row's first supported channel (`CUSTOMER_CHANNEL_ORDER` order,
 *    same as `CustomerChannelCell` below) — same shape/color as that same
 *    record header's own collapsed-width "Add Channel" trigger.
 *  - Otherwise (full-screen/wide): one button per supported channel
 *    instead. Voice gets a large solid-primary "Call" button (`Phone` icon
 *    + label) — the same singled-out treatment that record header gives
 *    Voice once ITS OWN width threshold is crossed — every other channel
 *    (SMS/Email/WhatsApp) is an equally-weighted, always-visible outline
 *    icon button (`CustomerChannelPopoverButton`'s own `alwaysVisible`
 *    variant — see that prop's own doc comment for why this header can't
 *    reuse its default hover-reveal-on-row-hover behavior).
 *
 *  Every button here opens its own independent `CustomerChannelPicker`
 *  popover instance, all sharing one `openChannel` piece of state (only one
 *  can meaningfully be open at a time) rather than each owning a disconnected
 *  copy the way `CustomerChannelPopoverButton`'s own per-row icons do (there,
 *  each icon lives in a different table row and is never rendered alongside
 *  a sibling from the same row, so that concern doesn't apply). */
export function CustomerAddChannelButton({
  row,
  isNarrow,
  onStartInteraction,
}: {
  /** `null` while `CustomerRowInfoPanel` is closed (its header still mounts
   *  during the close animation — see that component's own render) — there's
   *  no record to add a channel to yet, so this just renders disabled. */
  row: CustomerListRecord | null;
  /** `CustomerRowInfoPanel`'s own `isNarrowActions` (docked vs. full
   *  screen) — see this component's own doc comment above for what each
   *  mode renders. */
  isNarrow: boolean;
  onStartInteraction: (contact: CreateNewOutboundContact, channel: ChannelType, phone: string, skillId: string) => void;
}) {
  const [openChannel, setOpenChannel] = useState<ChannelType | null>(null);
  const available = useRowChannels(row);
  if (!row || available.length === 0) {
    return (
      <ActionIconButton title="Add channel" disabled>
        <Plus className="h-4 w-4" />
      </ActionIconButton>
    );
  }
  if (isNarrow) {
    return (
      <CustomerChannelPicker
        row={row}
        defaultChannel={available[0]}
        available={available}
        onStartInteraction={onStartInteraction}
        open={openChannel === available[0]}
        onOpenChange={(open) => setOpenChannel(open ? available[0] : null)}
        trigger={
          // Plain `Button variant="default"` (lyra-ui's own already-correct
          // solid-primary treatment — background/hover/active all come
          // from that one variant, button.tsx), NOT `ActionIconButton` with
          // hand-pasted `bg-lyra-bg-primary`/`hover:bg-lyra-state-hover-
          // primary` overrides — confirmed live those fought
          // `ActionIconButton`'s own `variant="icon"` base hover/active
          // classes (both present in the merged class list, `cn`'s
          // `tailwind-merge` doesn't know the two are meant to be mutually
          // exclusive since neither is a plain Tailwind core utility, so
          // which one visually wins comes down to arbitrary stylesheet
          // order rather than className order) instead of cleanly
          // replacing them, which is what produced the wrong/muddy hover.
          // `size="icon-md"` (32px) — one notch below `ActionIconButton`'s
          // own default `icon-lg` (36px), matching prev/next's own
          // `size="icon-md"` a few lines below this component's own call
          // site, per explicit request for a smaller button here too. Still
          // wrapped in the same auto-tooltip `Button` gives any icon-sized
          // button with a `title` (see button.tsx's own `isIconVariant &&
          // title` branch), so "Add channel" still shows on hover exactly
          // like `ActionIconButton` gave it before.
          <Button
            variant="default"
            size="icon-md"
            title="Add channel"
            aria-expanded={openChannel === available[0]}
          >
            <Plus className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
          </Button>
        }
      />
    );
  }
  return (
    <>
      {available.map((channel) =>
        channel === "voice" ? (
          <CustomerChannelPicker
            key={channel}
            row={row}
            defaultChannel={channel}
            available={available}
            onStartInteraction={onStartInteraction}
            open={openChannel === channel}
            onOpenChange={(open) => setOpenChannel(open ? channel : null)}
            trigger={
              // `size="sm"` (was `"md"`) — per explicit request ("match the
              // sizes of the channel buttons to the size of the edit
              // button"), this wide-mode branch is now only ever rendered
              // inside the Customer Overview card's own top row (see this
              // component's own call site, agent-next-gen-customer-info-
              // panel.tsx), right next to that card's `size="sm"` Edit
              // button — matching height/label-scale here keeps the whole
              // row reading as one consistent size, not Call standing out
              // larger than its neighbors.
              <Button
                variant="default"
                size="sm"
                aria-expanded={openChannel === channel}
                className="gap-1.5"
              >
                <Phone className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
                Call
              </Button>
            }
          />
        ) : (
          <CustomerChannelPopoverButton
            key={channel}
            row={row}
            channel={channel}
            available={available}
            onStartInteraction={onStartInteraction}
            alwaysVisible
            // `"xs"` (24px) — same reasoning as the Call button's own
            // `size="sm"` swap just above: matches the Customer Overview
            // card's `size="sm"` Edit button sitting in the same row.
            size="xs"
          />
        )
      )}
    </>
  );
}

/** Hover-reveal channel icons for a row's supported channels — reuses
 *  lyra-ui's own `CHANNEL_TYPE_META` icon/label map (channel-row.tsx) so
 *  the icon-per-channel choice stays identical to every other channel
 *  picker in the app, rather than redeclaring Phone/Mail/MessageSquare/
 *  WhatsAppIcon here. Each icon opens its own launch popover — see
 *  `CustomerChannelPopoverButton`. Fades in on row hover/focus-within,
 *  matching the Copy/Add-tag hover-toolbar convention used on conversation
 *  bubbles elsewhere in this file; the row itself needs `className="group"`
 *  for this to fire (added on `TableRow` below). */
export function CustomerChannelCell({
  row,
  onStartInteraction,
}: {
  row: CustomerListRecord;
  onStartInteraction: (contact: CreateNewOutboundContact, channel: ChannelType, phone: string, skillId: string) => void;
}) {
  const available = useRowChannels(row);
  if (available.length === 0) {
    return <span className="lyra-body-sm text-lyra-fg-disabled">—</span>;
  }
  return (
    <div className="flex items-center gap-1">
      {available.map((c) => (
        <CustomerChannelPopoverButton
          key={c}
          row={row}
          channel={c}
          available={available}
          onStartInteraction={onStartInteraction}
        />
      ))}
    </div>
  );
}

/** Hover-only leading overlay of a row's supported channel icons — per
 *  explicit request/follow-up (with screenshots), NOT a fixed leading
 *  column: pinned to the row's own left edge via `position: absolute`
 *  (needs `leadingChannelStack`'s own `TableRow` to be `relative` — see
 *  that prop's own doc comment) rather than a real flex child, so it
 *  reserves zero layout space of its own — no extra header cell, no extra
 *  column width — and instead paints directly over whichever cell(s)
 *  happen to sit at the row's leading edge (`Contact Number`, currently)
 *  only while that row is actually hovered/focused. A first version of
 *  this reserved a real fixed-width leading column and rendered the icons
 *  as an always-visible overlapping "avatar stack" — corrected per
 *  explicit follow-up ("I don't want the channels to display until the
 *  agent hovers on the row - then also you have them overlapping each
 *  other which is not desirable - also remove the extra column space in
 *  the header - these icons should overlay whatever content is in the row
 *  when they display") to this hover-only, non-overlapping, zero-reserved-
 *  space version instead.
 *
 *  Each icon is still the same real `CustomerChannelPopoverButton` (own
 *  launch popover, own click handler), now with the plain `overlay`
 *  variant (see that prop's own doc comment) — no chip background/ring of
 *  its own, since the *shared strip* this returns supplies one opaque
 *  background and one `group-hover`-driven fade for the whole cluster.
 *  Icons are laid out with a plain `gap-1.5` (no negative margin/overlap)
 *  per the "overlapping... is not desirable" correction above. Sizing per
 *  a further explicit follow-up ("make the padding-left/right 4px for the
 *  channel icon button container, make the full border radius 6px and add
 *  4px margin-left so it feels contained within the row" — with a
 *  screenshot): `rounded-lyra-sm` (the design system's 6px radius token, on
 *  all four corners — the earlier version only rounded the trailing edge),
 *  `ml-1` (4px) so the strip doesn't sit flush against the row's own left
 *  edge. A later follow-up (another screenshot) swapped the original
 *  `pl-1`/`pr-1` (4px horizontal padding) for `my-1` (4px vertical margin,
 *  top and bottom) instead — the strip is `inset-y-0` (top:0/bottom:0)
 *  against the row, so vertical margin on top of that shrinks it to a
 *  shorter pill centered in the row with a visible gap above/below, rather
 *  than padding widening its horizontal footprint around the icons. Only
 *  rendered when
 *  `CustomersListView` is given `leadingChannelStack` (Premium/Advanced
 *  call sites only) — NOT a replacement for `CustomerChannelCell` itself,
 *  which stays exactly as-is for every other consumer. */
export function CustomerChannelStack({
  row,
  onStartInteraction,
}: {
  row: CustomerListRecord;
  onStartInteraction: (contact: CreateNewOutboundContact, channel: ChannelType, phone: string, skillId: string) => void;
}) {
  const available = useRowChannels(row);
  if (available.length === 0) {
    return null;
  }
  return (
    <div
      className={cn(
        // `ml-[36px]` (was `ml-1`/4px) — per explicit follow-up, with a
        // screenshot showing the overlay painting directly over the row's
        // leading `isRowOpen` "eye" icon column (§58): that column is fixed
        // `w-[40px]`, so a 4px inset left this absolutely-positioned overlay
        // (still anchored `left-0` against the row itself, not that column)
        // covering it whenever both were present on the same row. 36px
        // clears the eye-icon column's own width, applied unconditionally —
        // for the majority of rows with `leadingChannelStack` but no
        // `isRowOpen` (2.0's Desk-tab table, if ever wired) this just reads
        // as a bit more inset from the row edge, not a visible bug.
        "absolute inset-y-0 left-0 z-10 flex items-center gap-1.5 my-1 ml-[36px]",
        "rounded-lyra-sm",
        "opacity-0 pointer-events-none transition-opacity",
        "group-hover:opacity-100 group-hover:pointer-events-auto",
        "group-focus-within:opacity-100 group-focus-within:pointer-events-auto",
        // Solid (fully opaque) white background, sized to the icon cluster
        // itself (not stretched across the row) — per explicit follow-up:
        // `lyra-state-hover` (tried first) turned out to be a translucent
        // "opacity" token (`--lyra-color-state-bg-hover-opacity`), so the
        // underlying cell's own text showed faintly through the icons on
        // hover instead of being fully covered. `lyra-bg-surface-base` is a
        // real opaque color (`#fff` light / dark-surface dark), not an
        // alpha overlay, so it actually hides what's underneath. Also adds
        // a subtle shadow so the now fully-opaque overlay still reads as
        // "lifted" above the row rather than looking like a plain edit to
        // the cell's own background.
        "bg-lyra-bg-surface-base shadow-sm"
      )}
    >
      {available.map((c) => (
        <CustomerChannelPopoverButton
          key={c}
          row={row}
          channel={c}
          available={available}
          onStartInteraction={onStartInteraction}
          overlay
        />
      ))}
    </div>
  );
}

// Proportional `flex-[n]` ratios — same shape as DataManagement.stories.tsx's
// own `columnConfig` — so the table shrinks/grows to fill exactly whatever
// width is available. `minWidth`/`minWidthPx` are a per-column readability
// floor (same px value, once as a Tailwind class for the cell itself, once
// as a plain number so `CustomersListView` can sum the visible columns and
// feed the total to `<Table style={{ minWidth }}>` — see the long comment
// down there for why the *cell-level* class alone isn't enough to get a
// real horizontal scrollbar here). (Class strings are written out in full,
// not built from the numbers via template literals — Tailwind's build only
// picks up `min-w-[…]` utilities that appear literally in source.)
export const CUSTOMER_COLUMN_CONFIG: Record<CustomerColKey, { label: string; flex: string; minWidth: string; minWidthPx: number }> = {
  contactNumber: { label: "Contact Number", flex: "flex-1",      minWidth: "min-w-[120px]", minWidthPx: 120 },
  channels:      { label: "Channels",       flex: "flex-1",      minWidth: "min-w-[150px]", minWidthPx: 150 },
  firstName:     { label: "First Name",     flex: "flex-1",      minWidth: "min-w-[100px]", minWidthPx: 100 },
  lastName:      { label: "Last Name",      flex: "flex-1",      minWidth: "min-w-[100px]", minWidthPx: 100 },
  group:         { label: "Group",          flex: "flex-[0.7]",  minWidth: "min-w-[90px]",  minWidthPx: 90 },
  firstPhone:    { label: "First Phone",    flex: "flex-[1.2]",  minWidth: "min-w-[140px]", minWidthPx: 140 },
  emailAddress:  { label: "Email Address",  flex: "flex-[1.6]",  minWidth: "min-w-[200px]", minWidthPx: 200 },
  address1:      { label: "Address 1",      flex: "flex-[1.6]",  minWidth: "min-w-[180px]", minWidthPx: 180 },
  city:          { label: "City",           flex: "flex-1",      minWidth: "min-w-[100px]", minWidthPx: 100 },
  state:         { label: "State",          flex: "flex-[0.6]",  minWidth: "min-w-[70px]",  minWidthPx: 70 },
  postalCode:    { label: "Postal Code",    flex: "flex-[0.8]",  minWidth: "min-w-[100px]", minWidthPx: 100 },
};

// Fixed-width column outside `CUSTOMER_COLUMN_CONFIG` — the trailing sticky
// "Actions" (delete) column — added to the visible columns' summed
// `minWidthPx` below to get the table's true minimum width.
export const CUSTOMER_FIXED_COLUMNS_WIDTH = 48 /* actions */;

export const CUSTOMER_ALL_COLUMN_DEFS: { key: string; label: string }[] = Object.entries(CUSTOMER_COLUMN_CONFIG).map(
  ([key, val]) => ({ key, label: val.label })
);
export const CUSTOMER_ALL_COLUMN_KEYS = Object.keys(CUSTOMER_COLUMN_CONFIG) as CustomerColKey[];

// Every field the "+ Filter" add-filter menu can offer — real, filterable
// fields on `CUSTOMER_LIST_RECORDS` (not decoration), in the same order as
// the reference "Add Filter" list this was built from. Picking one from the
// menu is what actually adds it as a live `FilterChip` in the toolbar (see
// `addedFilterKeys` in `CustomersListView`) — this array only lists what's
// *available* to add, not what's currently active.
export const CUSTOMER_FILTER_FIELD_DEFS: { key: CustomerFilterKey; label: string }[] = [
  { key: "contactNumber", label: "Customer ID" },
  { key: "originalCustomerId", label: "Original customer ID" },
  { key: "firstPhone", label: "Phone" },
  { key: "emailAddress", label: "Email address" },
  { key: "dateOfBirth", label: "Date of birth" },
  { key: "group", label: "Group" },
  { key: "agent", label: "Agent" },
  { key: "agentTeam", label: "Agent team" },
  { key: "address1", label: "Address 1" },
  { key: "paymentBalance", label: "Payment balance" },
  { key: "firstName", label: "First name" },
  { key: "lastName", label: "Last name" },
];

// Options shown inside a given field's own `FilterChip` once it's been
// added — the distinct values actually present across `CUSTOMER_LIST_
// RECORDS` for that field. Precomputed once at module load (the records
// themselves never change at runtime), same reasoning `CUSTOMER_STATE_
// OPTIONS` used before this became a general multi-field system.
export const CUSTOMER_FILTER_VALUE_OPTIONS: Record<CustomerFilterKey, FilterChipOption[]> = Object.fromEntries(
  CUSTOMER_FILTER_FIELD_DEFS.map(({ key }) => [
    key,
    Array.from(new Set(CUSTOMER_LIST_RECORDS.map((r) => r[key]).filter(Boolean))).map((v) => ({ value: v, label: v })),
  ])
) as Record<CustomerFilterKey, FilterChipOption[]>;

export function CustomersListView({
  onStartInteraction,
  addedFilterKeys,
  onAddedFilterKeysChange,
  filterValues,
  onFilterValuesChange,
  onRowClick,
  searchQuery,
  onSearchChange,
  sortKey,
  sortDir,
  onSort,
  sortedRows,
  openRowId,
  leadingChannelStack = false,
  isRowOpen,
}: {
  onStartInteraction: (contact: CreateNewOutboundContact, channel: ChannelType, phone: string, skillId: string) => void;
  // Filter state is a controlled prop, not local `useState`, so it lives on
  // (and survives) `AgentNextGenPage` itself instead of resetting every
  // time this component unmounts — which happens on every navigation away
  // from the Desk dashboard (an active interaction, Settings), not just
  // when switching between desk tabs. See the state's own declaration
  // comment in `AgentNextGenPage` for the full explanation.
  addedFilterKeys: string[];
  onAddedFilterKeysChange: (keys: string[]) => void;
  filterValues: Record<string, string[]>;
  onFilterValuesChange: (values: Record<string, string[]>) => void;
  /** Opens `CustomerRowInfoPanel` for the clicked row — lifted up to
   *  `AgentNextGenPage` for the same reason the filter state above is:
   *  that panel renders as a sibling of this whole component (docked to
   *  the right of it, not nested inside), so its "which row" state has to
   *  live on their common parent, not in here. */
  onRowClick: (row: CustomerListRecord) => void;
  // Search/sort are also controlled props now, computed into `sortedRows`
  // by `AgentNextGenPage` (not locally in here) — so `CustomerRowInfoPanel`'s
  // next/back chevrons can step through the exact same order this table is
  // rendering, rather than each maintaining its own possibly-divergent copy
  // of the same filter/sort logic. See that state's own declaration comment
  // in `AgentNextGenPage`.
  searchQuery: string;
  onSearchChange: (query: string) => void;
  sortKey: CustomerColKey | null;
  sortDir: SortDirection;
  onSort: (key: CustomerColKey) => void;
  sortedRows: CustomerListRecord[];
  /** `contactNumber` of the row currently open in `CustomerRowInfoPanel`
   *  (or `null`), so that row can show as selected/highlighted in the
   *  table itself while its panel is open. */
  openRowId: string | null;
  /** Per explicit request (with screenshots) — renders the row's channel
   *  icons as `CustomerChannelStack`'s hover-only leading overlay instead
   *  of `CustomerChannelCell`'s row-of-icons living inside a normal,
   *  reorderable/toggleable "Channels" column. The overlay reserves zero
   *  layout space of its own (`position: absolute`, painted over whichever
   *  cell sits at the row's leading edge, only while that row is
   *  hovered/focused — see `CustomerChannelStack`'s own doc comment for
   *  why, including the correction from an earlier always-visible/
   *  overlapping-avatar-stack version), so no extra header cell or column
   *  width is added anywhere. Defaults `false` (fully unchanged existing
   *  behavior) — only Agent Workspace 2.0 Premium's and Advanced's own
   *  `<CustomersListView>` call sites pass `true`; 2.0's own Desk-tab usage
   *  and the Search panel's usage (`agent-next-gen-search-panel.tsx`) were
   *  out of scope for this request and stay on the original "Channels"
   *  column. */
  leadingChannelStack?: boolean;
  /**
   * Per explicit request ("add a blank column header and if a record is
   * open as an assignment or as a tab add an eye icon to indicate it is
   * being viewed by someone") — an optional per-row lookup a consumer can
   * pass to indicate a customer is currently open elsewhere (a left-nav
   * assignment card, a customer full-screen tab, etc.). When provided, a
   * fixed leading column (blank/`sr-only` header, same non-reorderable/
   * non-toggleable treatment as the trailing "Actions" column below) shows
   * a Lucide `Eye` icon for any row this returns `true` for. Deliberately
   * a caller-supplied function rather than this component reaching into
   * `interactions`/`openCustomerTabs` state itself — those are owned by
   * each page file, not this shared table, and Advanced has no customer
   * full-screen tabs at all (see AgentWorkspaceAdvancedPage.tsx's own
   * `isRowOpen` call site) — keeping the check itself entirely up to the
   * caller means this component doesn't need to know which "open"
   * mechanisms exist in a given tier. Omit entirely (default: no column
   * rendered at all) for consumers that don't want this indicator — 2.0's
   * own Desk-tab usage is out of scope for this request and doesn't pass
   * it, so it renders exactly as before. Per a later explicit follow-up
   * (screenshot showing the `leadingChannelStack` hover overlay covering
   * this column on Agent Workspace Advanced's Search-panel Customers
   * sub-tab, "you didn't add the icon to advanced" / "I mean advanced"),
   * the Search panel's own Customers sub-tab (`agent-next-gen-search-
   * panel.tsx`) — which per its own `leadingChannelStack` doc comment
   * already only ever renders from Advanced — now wires this too, reusing
   * the exact same `interactions.some(...)` check Advanced's main Desk-tab
   * table already passes (no `openCustomerTabs` concept there, same as
   * that call site).
   */
  isRowOpen?: (row: CustomerListRecord) => boolean;
}) {
  // `"channels"` is dropped from the column system entirely in
  // `leadingChannelStack` mode — it's no longer a normal column at all
  // (see `leadingChannelStack`'s own doc comment above), so it can't be
  // reordered via drag or shown/hidden via `ColumnToggle`.
  const columnKeys = leadingChannelStack
    ? CUSTOMER_ALL_COLUMN_KEYS.filter((k) => k !== "channels")
    : CUSTOMER_ALL_COLUMN_KEYS;
  const columnDefs = leadingChannelStack
    ? CUSTOMER_ALL_COLUMN_DEFS.filter((d) => d.key !== "channels")
    : CUSTOMER_ALL_COLUMN_DEFS;
  const [visibleCols, setVisibleCols] = useState<Set<string>>(new Set(columnKeys));

  // Which fields the agent has actually added via the "+ Filter" menu below
  // — only these get rendered as live `FilterChip`s / applied to `filtered`.
  // Starts empty (in the lifted state's own initializer): no filter is
  // active until the agent explicitly adds one, matching the reference
  // "Add Filter" menu this was built from.
  const filterDefs = addedFilterKeys.map((key) => {
    const def = CUSTOMER_FILTER_FIELD_DEFS.find((f) => f.key === key)!;
    return { key: def.key, label: def.label, options: CUSTOMER_FILTER_VALUE_OPTIONS[def.key] };
  });
  const handleFilterChange = (key: string, values: string[]) => onFilterValuesChange({ ...filterValues, [key]: values });
  const clearAllFilters = () => onFilterValuesChange({});
  // Adding/removing a field from the "+ Filter" menu — removing one also
  // drops its stored selected values, so re-adding it later starts fresh
  // instead of resurrecting a stale selection nobody can see in the meantime.
  const handleAddedFiltersChange = (keys: string[]) => {
    onAddedFilterKeysChange(keys);
    onFilterValuesChange(Object.fromEntries(Object.entries(filterValues).filter(([k]) => keys.includes(k))));
  };

  const { columnOrder: allColumnOrder, dragOverKey, dragHandlers } = useColumnReorder<CustomerColKey>(
    columnKeys
  );
  const columnOrder = allColumnOrder.filter((k: CustomerColKey) => visibleCols.has(k));

  // Explicit total min-width for `<Table>`, computed from the currently
  // *visible* columns' own `minWidthPx` (+ the fixed checkbox/actions
  // columns) — same technique `resize.totalWidth` uses internally (see
  // table.tsx's own long comment on `Table`'s `<table>` element): a
  // concrete pixel `min-width` reliably cascades down through
  // `thead`/`tbody`/`tr` via top-down `align-items: stretch`, which plain
  // per-cell `min-w-[…]` classes alone don't — Chrome doesn't reliably
  // propagate flexbox's "automatic minimum size" back *up* through this
  // many nested flex levels (table → tbody → tr → td) to make the row's
  // own box (and therefore its `border-b`/hover background) grow to match.
  // Without this, the columns individually refuse to shrink below their
  // `min-w-[…]` floor (so text stays readable and content visibly scrolls
  // into view), but each row's own painted box stays capped at the
  // container's original width — exactly the "row separator lines vanish
  // once scrolled past that boundary" bug reported via screenshot. This
  // only takes effect before any manual column resize; once a column is
  // actually dragged, `Table` swaps in `resize.totalWidth` (computed from
  // real registered widths) in its place.
  const tableMinWidth =
    CUSTOMER_FIXED_COLUMNS_WIDTH +
    columnOrder.reduce((sum: number, key: CustomerColKey) => sum + CUSTOMER_COLUMN_CONFIG[key].minWidthPx, 0);

  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  const dirFor = (key: CustomerColKey): SortDirection => (sortKey === key ? sortDir : null);
  const sorted = sortedRows;

  const totalRecords = sorted.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / rowsPerPage));
  const safePage = Math.min(currentPage, totalPages);
  const startIdx = (safePage - 1) * rowsPerPage;
  const pageRows = sorted.slice(startIdx, startIdx + rowsPerPage);
  const displayStart = totalRecords === 0 ? 0 : startIdx + 1;
  const displayEnd = Math.min(startIdx + rowsPerPage, totalRecords);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [rowsPerPage, totalPages, currentPage]);

  return (
    // `min-w-0 overflow-hidden` — this is a flex ITEM inside the Desk
    // body's row container (`<div className="relative flex flex-1
    // overflow-hidden">`), and flex items default to `min-width: auto`
    // (refuse to shrink below their content's own intrinsic width).
    // Matches the sibling Dashboard-tab column's own `min-w-0` a few
    // lines below in this same file.
    <div className="flex flex-col flex-1 min-w-0 min-h-0 overflow-hidden">
      <TableToolbar
        className="px-6"
        searchQuery={searchQuery}
        onSearchChange={onSearchChange}
        filterDefs={filterDefs}
        filterValues={filterValues}
        onFilterChange={handleFilterChange}
        onFilterClear={clearAllFilters}
        // The "+ Filter" add-menu itself — `TableToolbar`'s own `filters`
        // slot renders right alongside the `filterDefs`-driven chips above
        // (table.tsx: filterChips, then filters, then the Clear button),
        // exactly where FilterChip.stories.tsx's own "Removable" demo
        // places this same trigger. Composed from `Select`
        // (multiple/searchable/showSelectAll, a custom "+ Filter" trigger
        // instead of its default text box) rather than lyra-ui's
        // `FilterChip` itself — `FilterChip` renders ONE already-added
        // filter's value picker; this is the separate "pick which fields
        // are active at all" control that decides what shows up in
        // `filterDefs` in the first place, same distinction
        // FilterChip.stories.tsx's own demo draws between its per-filter
        // chips and this single add-menu.
        filters={
          <Select
            options={CUSTOMER_FILTER_FIELD_DEFS.map((f) => ({ value: f.key, label: f.label }))}
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
        }
        actionDefs={[
          { key: "refresh", label: "Refresh", icon: <RefreshCw className="h-4 w-4" strokeWidth={1.5} /> },
          // Per explicit request, with a screenshot of the lucide "user-plus"
          // icon: "update the icon for new customers to be user-plus instead
          // of just + to avoid confusion with launching new interactions."
          // This was previously a plain `Plus`, visually identical to every
          // "launch a new interaction" trigger elsewhere in the app (e.g.
          // `CreateNew`'s "New Outbound" button, `AddChannelAdHocButton`),
          // making this toolbar button easy to misread as one of those
          // rather than as customer creation specifically.
          { key: "new", label: "New Customer", icon: <UserPlus className="h-4 w-4" strokeWidth={1.5} /> },
        ]}
        actions={
          <ColumnToggle
            columns={columnDefs}
            visibleColumns={visibleCols}
            onVisibilityChange={setVisibleCols}
          />
        }
      />

      <div className="flex-1 min-h-0 overflow-auto px-6">
        <Table style={{ minWidth: tableMinWidth }}>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {isRowOpen && (
                <TableHead className="w-[40px] shrink-0">
                  <span className="sr-only">Open</span>
                </TableHead>
              )}
              {columnOrder.map((key: CustomerColKey) => {
                const col = CUSTOMER_COLUMN_CONFIG[key];
                return (
                  <SortableTableHead
                    key={key}
                    className={cn(col.flex, col.minWidth, "relative")}
                    sortDirection={dirFor(key)}
                    onSort={() => onSort(key)}
                    columnKey={key}
                    dragHandlers={dragHandlers}
                    isDragOver={dragOverKey === key}
                    resizable
                    minWidth={80}
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
            {pageRows.map((row) => (
              <TableRow
                key={row.contactNumber}
                // `selectable` — lyra-ui's `TableRow` now handles row-level
                // keyboard focus/ADA ring/Enter-Space-selection and
                // `TableBody`'s own built-in ArrowUp/ArrowDown row
                // navigation itself (table.tsx); this used to be hand-rolled
                // here (a local `handleBodyKeyDown` + manual `tabIndex`/
                // focus-ring/`data-contact-number` plumbing) before that
                // behavior was generalized into the shared component so
                // every consumer gets it, not just this table — see
                // `TableRow`'s own `selectable` doc comment for the full
                // behavior.
                selectable
                className={cn(
                  "group cursor-pointer",
                  // `relative` — only needed so `CustomerChannelStack`'s own
                  // `absolute inset-y-0 left-0` overlay positions itself
                  // against THIS row instead of the nearest other
                  // positioned ancestor. See that component's own doc
                  // comment for why it's an absolutely-positioned overlay
                  // (reserving zero column width) rather than a real cell.
                  leadingChannelStack && "relative"
                )}
                data-state={row.contactNumber === openRowId ? "selected" : undefined}
                onClick={() => onRowClick(row)}
              >
                {isRowOpen && (
                  <TableCell className="w-[40px] shrink-0">
                    {isRowOpen(row) && (
                      <>
                        <Eye className="h-4 w-4 text-lyra-fg-secondary" strokeWidth={1.5} aria-hidden="true" />
                        <span className="sr-only">{`${row.firstName} ${row.lastName} is currently open`}</span>
                      </>
                    )}
                  </TableCell>
                )}
                {leadingChannelStack && (
                  // Per a real, reported bug (console warnings: "In HTML,
                  // <div> cannot be a child of <tr>. This will cause a
                  // hydration error." / "<tr> cannot contain a nested
                  // <div>"): `CustomerChannelStack` returns a plain `<div>`
                  // (its own `absolute inset-y-0 left-0` overlay — see that
                  // component's own doc comment), which used to render here
                  // as a direct sibling of the `<TableCell>`s below —
                  // i.e. a raw `<div>` as an immediate child of this row's
                  // `<tr>`, which the HTML table content model never allows
                  // (only `<td>`/`<th>` can be). Wrapped in a real `<td>` so
                  // this row stays valid HTML — `display: contents` on that
                  // `<td>` removes its own box entirely (so it contributes
                  // no width/gap to the row's flex layout, and doesn't
                  // become a new positioning ancestor for the overlay div's
                  // own `absolute` — the row's own `relative` above, per
                  // `leadingChannelStack && "relative"`, is still what the
                  // div positions against, unchanged from before this fix),
                  // while the `<td>` element itself still satisfies
                  // `<tr>`'s content model. `role="presentation"` — this
                  // `<td>` carries no real cell semantics of its own (the
                  // interactive content inside, the channel buttons, is
                  // what actually matters to assistive tech).
                  <td role="presentation" style={{ display: "contents" }}>
                    <CustomerChannelStack row={row} onStartInteraction={onStartInteraction} />
                  </td>
                )}
                {/* `stopPropagation` below — same reason the channel popover
                    buttons already stop it (see `CustomerChannelCell`):
                    without it, clicking this row's delete button would ALSO
                    open the Customer Information panel via the row's own
                    `onClick` above. */}
                {columnOrder.map((key: CustomerColKey) => (
                  <TableCell
                    key={key}
                    columnKey={key}
                    className={cn(CUSTOMER_COLUMN_CONFIG[key].flex, CUSTOMER_COLUMN_CONFIG[key].minWidth)}
                  >
                    {key === "channels" ? (
                      <CustomerChannelCell row={row} onStartInteraction={onStartInteraction} />
                    ) : (
                      row[key]
                    )}
                  </TableCell>
                ))}
                <TableCell
                  className="w-[48px] shrink-0 sticky right-0 bg-lyra-bg-surface-base"
                  onClick={(e: React.MouseEvent) => e.stopPropagation()}
                >
                  <button
                    aria-label={`Delete ${row.firstName} ${row.lastName}`}
                    className="flex h-7 w-7 items-center justify-center rounded-lyra-sm text-lyra-fg-secondary hover:bg-lyra-bg-surface-shell transition-colors"
                  >
                    <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                  </button>
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

/* ── Interaction history table (sortable) — content of each Latest Interactions accordion item ── */

export type InteractionSortKey = "owner" | "priority" | "createDate" | "status" | "channel" | "resolutionTime" | "skill";

/* Per-row "more options" kebab — opens a Menu with a single contextual
   action: voice interactions offer "Redial", everything else offers "Reopen".
   Built on the shared `KebabMenuButton` (composes `MenuRadix`) rather than a
   hand-rolled `Popover` + raw `<button>` + `Menu`, per CONTRIBUTING.md's
   Rule 0/"every menu must be built on Menu" — this exact trigger+menu shape
   is what `KebabMenuButton` exists for, and its default 24px size (not this
   row's old hand-picked 28px) matches every other per-row kebab in the
   design system (e.g. channel-row.tsx). No local open/setOpen state needed
   either — `MenuRadix` (unlike the bare `Menu` this used to wrap in a
   hand-rolled `Popover`) already closes itself on select. */
export function InteractionRowActions({ interaction }: { interaction: ContactInteraction }) {
  const isVoice = interaction.type === "voice";
  const isAssignedToMe = interaction.owner === CURRENT_AGENT_NAME;

  const items: MenuEntry[] = [];
  items.push(
    isVoice
      ? { id: "redial", label: "Redial", icon: <PhoneOutgoing className="h-4 w-4" strokeWidth={1.5} /> }
      : {
          id: interaction.status === "open" ? "open-interaction" : "reopen",
          label: interaction.status === "open" ? "Open Interaction" : "Reopen",
          icon: <RotateCcw className="h-4 w-4" strokeWidth={1.5} />,
        }
  );
  if (!isAssignedToMe) {
    items.push({
      id: "assign-to-me",
      label: "Assign To Me",
      icon: <UserPlus className="h-4 w-4" strokeWidth={1.5} />,
    });
  }
  items.push("separator");
  items.push({
    id: "customer-info",
    label: "Customer Information",
    icon: <UserRound className="h-4 w-4" strokeWidth={1.5} />,
  });

  return <KebabMenuButton items={items} ariaLabel="More options" />;
}

function InteractionsTable({ interactions }: { interactions: ContactInteraction[] }) {
  const [sortKey, setSortKey] = useState<InteractionSortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDirection>(null);

  const handleSort = (key: InteractionSortKey) => {
    if (sortKey === key) {
      const next = nextInteractionSortDirection(sortDir);
      setSortDir(next);
      if (next === null) setSortKey(null);
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const dirFor = (key: InteractionSortKey): SortDirection => (sortKey === key ? sortDir : null);

  const sorted = [...interactions].sort((a, b) => {
    if (!sortKey || !sortDir) return 0;
    const aVal = String(a[sortKey]).toLowerCase();
    const bVal = String(b[sortKey]).toLowerCase();
    if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
    if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
    return 0;
  });

  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className="w-[48px] shrink-0"><span className="sr-only">Type</span></TableHead>
          <SortableTableHead className="flex-[1.4]" sortDirection={dirFor("owner")} onSort={() => handleSort("owner")}>Owner Assignee</SortableTableHead>
          <SortableTableHead className="flex-[0.7]" sortDirection={dirFor("priority")} onSort={() => handleSort("priority")}>Priority</SortableTableHead>
          <SortableTableHead className="flex-1" sortDirection={dirFor("createDate")} onSort={() => handleSort("createDate")}>Create Date</SortableTableHead>
          <SortableTableHead className="flex-1" sortDirection={dirFor("status")} onSort={() => handleSort("status")}>Status</SortableTableHead>
          <SortableTableHead className="flex-[1.2]" sortDirection={dirFor("channel")} onSort={() => handleSort("channel")}>Channel</SortableTableHead>
          <SortableTableHead className="flex-1" sortDirection={dirFor("resolutionTime")} onSort={() => handleSort("resolutionTime")}>Resolution Time</SortableTableHead>
          <SortableTableHead className="flex-1" sortDirection={dirFor("skill")} onSort={() => handleSort("skill")}>Skill</SortableTableHead>
          <TableHead className="w-[48px] shrink-0"><span className="sr-only">Actions</span></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sorted.map((interaction) => (
          <TableRow key={interaction.id}>
            <TableCell className="w-[48px] shrink-0">
              <span className={cn("relative inline-flex h-4 w-4 items-center justify-center", CHANNEL_TYPE_ICON_COLOR_CLASS[interaction.type])}>
                {interaction.type === "email" ? (
                  <Mail className="h-4 w-4" strokeWidth={1.5} />
                ) : interaction.type === "voice" ? (
                  <Phone className="h-4 w-4" strokeWidth={1.5} />
                ) : (
                  <MessageCircle className="h-4 w-4" strokeWidth={1.5} />
                )}
                {interaction.direction === "inbound" ? (
                  <ArrowDown className="absolute -bottom-1 -left-1 h-3 w-3 rounded-full bg-lyra-bg-surface-base p-[1px]" strokeWidth={2} />
                ) : (
                  <ArrowUp className="absolute -bottom-1 -left-1 h-3 w-3 rounded-full bg-lyra-bg-surface-base p-[1px]" strokeWidth={2} />
                )}
              </span>
            </TableCell>
            <TableCell className="flex-[1.4]">{interaction.owner}</TableCell>
            <TableCell className="flex-[0.7]">{interaction.priority}</TableCell>
            <TableCell className="flex-1">{interaction.createDate}</TableCell>
            <TableCell className="flex-1">
              <span className="inline-flex items-center gap-1.5">
                <span
                  className={cn(
                    "h-2 w-2 rounded-full shrink-0",
                    interaction.status === "open" ? "bg-lyra-status-success-strong" : "bg-lyra-status-critical-strong"
                  )}
                  aria-hidden="true"
                />
                {interaction.status === "open" ? "Open" : "Closed"}
              </span>
            </TableCell>
            <TableCell className="flex-[1.2]">{interaction.channel}</TableCell>
            <TableCell className="flex-1">{interaction.resolutionTime}</TableCell>
            <TableCell className="flex-1">{interaction.skill || "—"}</TableCell>
            <TableCell className="w-[48px] shrink-0">
              <InteractionRowActions interaction={interaction} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
