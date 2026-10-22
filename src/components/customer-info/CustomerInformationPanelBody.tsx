import { useState, useMemo } from "react";
import { t } from "@/i18n";
import {
  Label,
  Button,
  Accordion,
  Input,
  PhoneInput,
  EmailInput,
  Separator,
  Badge,
  type CreateNewOutboundContact,
  type ChannelType,
  formatPhoneForDisplay,
} from "@nicecxone/lyra-ui";
import { Clock, FileText, Pencil, ChevronRight } from "lucide-react";
import { type Thread } from "@/components/agent-next-gen-interaction-dashboard";
import { phoneValueFromDisplay, phoneDisplayFromValue } from "@/components/agent-next-gen-shared-utils";
import { type CustomerListRecord, CustomerAddChannelButton } from "@/components/agent-next-gen-customers-table";
import { cn } from "@/lib/utils";
import {
  CUSTOMER_PANEL_TABS,
  CUSTOMER_INFO_ACCORDION_CLASSNAME,
  buildCustomerHistoryEntries,
  type CustomerLatestInteraction,
  type CustomerLatestNote,
  type CopilotSummary,
  type CustomerHistorySessionEntry,
} from "./customer-info-seed";
import { CustomerHistoryTabContent, CustomerHistorySessionDetailPanel } from "./CustomerHistory";
import {
  CustomerDetailTabContent,
  CustomerDirectoryTabContent,
  CopilotTabContent,
  type CustomerRecordDraft,
  type CustomerDirectoryPhoneState,
} from "./CustomerDetailTabs";

/* ── CustomerInformationPanelBody ──
   Body content for the "Customer Information" `InteriorPanel` docked right
   of an active interaction — a profile block (avatar initials + name +
   presence),
   two placeholder tab sections, and a detail-row list, reproducing the
   reference mockup's layout as placeholder content (real per-tab data isn't
   wired up yet, same "prototype the shape first" status as the transcript
   above).

   The mockup's field rows (label left, value right, hairline divider) are
   lyra-ui's own documented "Label Horizontal With Separator" composition
   (see Input.stories.tsx) — `Label` (not a plain span) + a value span
   (`lyra-body-md text-lyra-fg-secondary`) + `Separator`, not literally the
   `Input` component itself (Input's own `readonly` mode still renders a
   bordered box, which isn't this shape at all — the horizontal/label-only
   look lives in this separate story pattern, composed from `Label` +
   `Separator`, both already lyra-ui exports). Avatar uses initials
   (`initialsFor`, already used everywhere else in this file) instead of
   the mockup's photo — no photo source exists for these interactions. */
export function CustomerInformationPanelBody({
  activeTab,
  customerName,
  latestInteraction,
  latestNote,
  copilotSummary,
  copilotExtra,
  recordId,
  channels,
  onOpenConversation,
  onViewAllInteractions,
  draft,
  onDraftChange,
  onPhoneChange,
  onOverviewFieldChange,
  overviewEditing = false,
  onOverviewEditingChange = () => {},
  allowOverviewEdit,
  row,
  onStartInteraction,
}: {
  activeTab: number;
  /** Overview's "Open Conversation" deep link (Latest Interaction
   *  accordion) — opens the newest past session's conversation as a TAB in
   *  the interaction space (record header), not inside this panel. Only
   *  the real side panel passes it; the hover preview doesn't. */
  onOpenConversation?: (entry: CustomerHistorySessionEntry) => void;
  /**
   * Overview's "View All Contacts" button (Latest Interaction
   * accordion, directly below "Open Conversation") — switches THIS SAME
   * panel over to its own "Contacts" tab (labeled "Interactions" until a
   * later explicit follow-up request renamed it), per explicit request.
   * Unlike `onOpenConversation` above (which opens a whole separate tab in
   * the interaction space), this stays entirely within the panel the agent
   * is already looking at — so every caller that owns `activeTab`/
   * `setActiveTab` (the real side panel, the hover preview, and the
   * Customers-table row panel alike) can wire this the same simple way:
   * `() => setActiveTab(CUSTOMER_PANEL_TABS.indexOf("Contacts"))`.
   * Gated at the render site below on `recordId` (not
   * `customerHistoryEntries.length`, unlike `onOpenConversation`) — the
   * Contacts tab itself is always worth switching to once a real
   * record exists, even for a customer with zero synthesized entries
   * (`CustomerHistoryTabContent`'s own empty state already covers that
   * case), whereas "Open Conversation" specifically needs a real newest
   * entry to open.
   */
  onViewAllInteractions?: () => void;
  /** Needed here (not just by `buildCustomerInfoFields`) for the
   *  Contacts tab's synthesized history (`buildCustomerHistoryEntries`
   *  below) — no longer threaded into the Detail tab directly, since that
   *  tab's First Name/Last Name now come from `draft` (seeded from this
   *  same `customerName` once, at draft-build time — see
   *  `buildCustomerRecordDraft`). */
  customerName?: string;
  /** Built per-interaction by `buildLatestInteraction` — see that
   *  function's own doc comment. */
  latestInteraction: CustomerLatestInteraction;
  /** Built per-interaction by `buildLatestNote` — see that function's own
   *  doc comment. Renders as its own accordion directly below Latest
   *  Interaction (see the "Latest Interaction"/"Latest Note" column
   *  comment below). */
  latestNote: CustomerLatestNote;
  /** Built per-interaction by `buildCopilotSummary` — see that function's
   *  own doc comment. Feeds the Copilot tab (`CopilotTabContent`). */
  copilotSummary: CopilotSummary;
  /** Passed straight through to `CopilotTabContent`'s own same-named prop —
   *  see that prop's own doc comment. Only `CustomerInformationSidePanel`
   *  ever sets this to a real value (the Marcus Webb scripted scenario,
   *  `AgentWorkspace2WithDeskPage.tsx`); every other caller leaves it
   *  `undefined`. */
  copilotExtra?: React.ReactNode;
  /** Supplied by every real consumer of this body — `CustomerInformationSidePanel`
   *  and `CustomerInfoHoverPreview` pass a real active interaction's own
   *  `recordId`/`channels`; `CustomerRowInfoPanel` (Customers-table row, no
   *  actually-open `Thread[]` of its own — a row was never opened
   *  as a real interaction) passes its own `recordId` with `channels={[]}`,
   *  which `buildCustomerHistoryEntries` already treats as "synthesize
   *  everything, nothing to prefer" — per explicit request, ALL THREE now
   *  show real (synthesized) Contacts-tab content, not just the two
   *  with a genuine active interaction behind them. Left truly `undefined`
   *  only if some future consumer has no record at all to show — see the
   *  Contacts-tab branch below, which still gates on `recordId` being
   *  falsy specifically (not on `channels`) for exactly that case. */
  recordId?: string;
  channels?: Thread[];
  /** Detail/Directory tabs' controlled draft — from the caller's own
   *  `useCustomerRecordDraft(fields, customerName, recordId)` (see that
   *  hook's own doc comment). Threaded straight through to
   *  `CustomerDetailTabContent`/`CustomerDirectoryTabContent` below rather
   *  than owned here, so `isDirty`/`save`/`cancel` stay visible to
   *  whichever caller renders the actual Save/Cancel footer (this body
   *  has no `footer` slot of its own to put it in). */
  draft: CustomerRecordDraft;
  onDraftChange: (patch: Partial<CustomerRecordDraft>) => void;
  onPhoneChange: (index: number, patch: Partial<CustomerDirectoryPhoneState>) => void;
  /** Edits one row of `draft.overviewFields` by index — see that field's
   *  own doc comment on `CustomerRecordDraft`. */
  onOverviewFieldChange: (index: number, value: string) => void;
  /** Whether the "Customer Overview" field list is currently showing real
   *  inputs (toggled by the ghost Edit button rendered above the first
   *  field) rather than plain read-only rows. Controlled by the caller —
   *  not local state here — because the caller (whichever of the two real
   *  panels renders the Save/Cancel footer) needs to know this too: per
   *  explicit request, the footer now appears the instant this flips
   *  `true` (clicking Edit), not only once a field has actually been
   *  changed. Defaults to `false` via the destructured default below for
   *  `CustomerInfoHoverPreview`, which never toggles it (omits
   *  `allowOverviewEdit`, so the button that would flip it never renders). */
  overviewEditing?: boolean;
  /** Fired when the ghost Edit button is clicked (toggles) — the caller
   *  owns the actual state (see `overviewEditing`'s own doc comment just
   *  above) and is also responsible for resetting it back to `false` on
   *  Save/Cancel and on switching to a different record; this body only
   *  ever asks to flip it. Omitted (defaults to a no-op) for
   *  `CustomerInfoHoverPreview`, which never renders the button that would
   *  call it. */
  onOverviewEditingChange?: (editing: boolean) => void;
  /** Whether this consumer should offer the "Customer Overview" edit
   *  button at all — per explicit request, only the two real panels
   *  (`CustomerInformationSidePanel`/`CustomerRowInfoPanel`, both of
   *  which also render the Save/Cancel footer this needs) do;
   *  `CustomerInfoHoverPreview` omits it (defaults to `undefined`/falsy)
   *  since it's a transient mouse-hover popover with no footer of its own
   *  to commit or cancel an edit through. */
  allowOverviewEdit?: boolean;
  /** Per explicit request ("move the contact icon buttons into the
   *  customer overview and put them next to the edit button in a row
   *  above the other information") — the row this customer came from,
   *  feeding `CustomerAddChannelButton` (always its "wide" one-button-
   *  per-channel shape here, matching `CustomerFullScreenTabContent`'s
   *  own prior header usage) so the channel launch buttons live inside
   *  this card's own top row instead of the panel/tab header. `undefined`/
   *  `null` for every consumer with no such row to launch a channel
   *  from — `CustomerInformationSidePanel` (an already-open interaction,
   *  never had these buttons at all) and `CustomerInfoHoverPreview`
   *  (never offered `allowOverviewEdit` either) simply omit this, and the
   *  new top row renders with no channel buttons in it (just the Edit
   *  button, if `allowOverviewEdit` is set) — same as `CustomerAddChannelButton`
   *  itself already does for a `null` row (see that component's own doc
   *  comment). */
  row?: CustomerListRecord | null;
  /** Required whenever `row` is a real (non-null) record — same signature
   *  `CustomerAddChannelButton` itself takes, just forwarded straight
   *  through. Optional here (not required outright) only so a consumer
   *  that never passes `row` doesn't also have to pass a never-called
   *  handler. */
  onStartInteraction?: (contact: CreateNewOutboundContact, channel: ChannelType, phone: string, skillId: string) => void;
}) {
  // Controlled (not `defaultValue`, unlike Latest Interaction beside it)
  // specifically so the stacked column below knows whether Latest Note
  // itself is open — needed to gate its own `flex-1` height-matching growth
  // (see that Accordion's own comment) off while it's collapsed. Growing a
  // COLLAPSED card to fill the column's full stretched height would stretch
  // its little closed header row across a tall box with a big dead gray gap
  // below it instead of matching content — the exact failure mode this
  // file's own `bothCardsOpen` gate was originally written to avoid for the
  // two cards' old side-by-side row (see git history), reapplied here to
  // just the one trailing card that actually needs it now.
  const [latestNoteAccordionValue, setLatestNoteAccordionValue] = useState("latest-note");
  const latestNoteOpen = latestNoteAccordionValue !== "";
  // Same controlled pattern, same reasoning, for Customer Overview itself —
  // per explicit follow-up request, height-matching between the two
  // COLUMNS now has to work in BOTH directions: Customer Overview used to
  // be assumed the reliably-taller side (see `CUSTOMER_INFO_ACCORDION_
  // CLASSNAME`'s `h-fit` on it, still the default height), with only the
  // right-hand stacked column ever growing to match it. Adding "View All
  // Contacts" to Latest Interaction can now push the RIGHT column
  // taller instead for some customers (a long field list isn't guaranteed
  // to stay the taller side any more) — so Customer Overview needs the
  // exact same "stay `h-fit` while collapsed, grow to match while open"
  // toggle Latest Note already has, just applied to the ROW's cross axis
  // (height, via the row's own default `align-items: stretch`) instead of
  // a COLUMN's main axis (see that Accordion's own `flex-1 h-auto` comment
  // for the axis distinction) — no `flex-1` needed here for that reason,
  // just clearing `h-fit` to `h-auto` is enough to let the row's existing
  // stretch behavior size it to match whichever side is actually taller.
  const [customerOverviewAccordionValue, setCustomerOverviewAccordionValue] = useState("customer-overview");
  const customerOverviewOpen = customerOverviewAccordionValue !== "";

  // Contacts tab — this customer's synthesized session history
  // (`CustomerHistoryTabContent`/`CustomerHistorySessionDetailPanel`, see
  // that section's own doc comment) — was a separate, independently-
  // selectable "Customer History" tab in the record header before, moved in
  // here per explicit request so it's just another tab of this same panel.
  // State lives locally in this component (not lifted to `AgentNextGenPage`
  // the way it used to be) because this whole component already remounts on
  // a genuine interaction switch via its caller's own
  // `key={`side-panel-${activeInteraction.id}`}` wrapper — the exact same
  // "survives navigate-away-and-back to the SAME interaction, resets on a
  // genuinely different one" behavior the old lifted state was hand-rolling
  // via a ref-based identity check, now free from the remount itself.
  // `undefined` while `recordId` isn't supplied (see that prop's own doc
  // comment) — this tab renders nothing at all in that case, so the
  // synthesized-entries memo just yields an empty array and nothing below
  // ever reads `selectedHistoryIndex`.
  const customerHistoryEntries = useMemo(
    () => (recordId ? buildCustomerHistoryEntries(customerName, recordId, channels ?? []) : []),
    [customerName, recordId, channels]
  );
  const [selectedHistoryIndex, setSelectedHistoryIndex] = useState<number | null>(null);
  const selectedHistoryEntry = selectedHistoryIndex !== null ? customerHistoryEntries[selectedHistoryIndex] ?? null : null;

  const handleHistoryNav = (direction: 1 | -1) => {
    setSelectedHistoryIndex((prev) => {
      if (prev === null) return prev;
      const next = prev + direction;
      if (next < 0 || next >= customerHistoryEntries.length) return prev;
      return next;
    });
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* `h-full min-h-0` — unconditional, every tab, not just gated to
          Contacts. Two earlier attempts at giving Contacts its own
          independently-scrolling box (one gated to just this tab, one
          unconditional like this) both failed live — but the actual root
          cause turned out to be one level up, not here: `SidePanel`'s own
          pinned/docked branch (side-panel.tsx) was missing the `h-full`
          its unpinned/full-screen branch already had, so `PanelContent`
          above this wrapper never reliably had a DEFINITE height to give
          it in docked mode specifically (confirmed by the exact symptom
          reported: full-screen scrolled fine, docked didn't — full-screen
          reaches its height a completely different way, `position:
          absolute` against `Container`'s own unambiguous flex-grow height,
          which was never affected by the bug). With that fixed at its
          actual source, this wrapper's own `h-full` now resolves correctly
          again — every tab gets a real box matching `PanelContent`'s
          available height (harmless for Overview/Detail/etc., which just
          overflow it normally with no clipping, same as always), and the
          Contacts tab below gets a genuinely bounded box to build its
          own internal list-scroll + overlaying detail panel on top of. */}
      {/* No avatar/name/presence block here — the InteriorPanel's own
          header (`headerTitle="Customer Information"` +
          `headerSubhead="{name} · {id}"`) already shows the name, so a
          second name+avatar block right below it was redundant.

          No tabs here either anymore — they used to live at the top of
          this same scrolling body, pinned via a hand-rolled `sticky`
          wrapper (see the git history / CONTRIBUTING.md's "Composing
          panel body content" for the full story of why that was wrong:
          the surrounding scroll container's own scrollbar still ran
          alongside a merely-`sticky` row, and `TabList`'s "N More"
          overflow menu had its own separate bug where selecting a tab
          from it silently did nothing once the row collapsed, fixed in
          tabs.tsx). They now render inside the header itself via
          `SidePanel`'s `headerTabs` prop — see
          `CustomerInformationSidePanel` below, which owns the
          `activeTab` state both this body and that header tab row need
          and passes this component just the number.

          This field list and the Customer Overview/Latest Interaction/
          Latest Note block below it are now both explicitly gated to the
          Overview tab (`activeTab === ...indexOf("Overview")`) —
          previously only the accordions had that gate, so this list
          rendered on every tab, including the new Detail tab added below,
          which shows its own full editable version of the same fields
          (`CustomerDetailTabContent`) and would otherwise show them twice.

          Layout (per explicit follow-up request): Customer Overview is now
          its own full-width row on top; Latest Interaction and Latest Note
          share one `.lyra-card-split-wrap`/`.lyra-card-split` row below it
          (see lyra-tokens.css) — reusing the same family `DashboardCard`
          bodies already use for "a couple of regions side by side,
          stacking once the container's own width gets tight" rather than
          inventing a new one (its ≤480px threshold already fits here on
          both ends: this panel's normal resizable range, ~350–425px per
          `InteriorPanel`'s own min/max defaults, stays comfortably under
          it — single column, unchanged from before this existed — and
          `allowFullScreen`'d width is easily past it — side by side).
          (Earlier arrangement, superseded here: Latest Interaction paired
          with Customer Overview in the split row, Latest Note full-width
          below both — moved per this follow-up request so Latest
          Interaction sits directly left of Latest Note instead.)

          Top/bottom order (both row and stacked state) falls straight out
          of plain DOM order — flexbox doesn't reverse either axis without
          an explicit `row-reverse`/`column-reverse`, so whichever child
          comes FIRST in the JSX is the TOP block regardless of state here
          (Customer Overview, full width, has no row-state sibling to sit
          left/right of). `align-items: stretch` (the split family's own
          default) is harmless here specifically because `Accordion`'s own
          root has no `h-full`/`flex-1` of its own (accordion.tsx) — a
          stretched flex item just leaves invisible empty space below its
          natural-height content, not a visibly over-tall bordered box.

          Unlike `.lyra-container-grid`/`.lyra-form-grid`, `.lyra-card-
          split` does NOT put `flex: 1 1 0%` on its children automatically
          — that family's own two optional modifiers (`.lyra-card-split-
          fixed`, a deliberately fixed 12rem column; `.lyra-card-split-
          chart`, `flex: 1 1 0%` for the region beside it) exist precisely
          because its usual pairing is one fixed-width region next to one
          flexible one, not two equal columns. Left as plain children, the
          two `Accordion`s took their own natural content width instead,
          rendering visibly unequal (each has its own different content
          length). The `.lyra-card-split-even` modifier (lyra-tokens.css)
          on both fixes that, splitting the row evenly (and correctly
          resetting back to full-width at the stacked stage, same as
          `.lyra-container-grid`/`.lyra-form-grid`'s own children — see
          that modifier's own doc comment for why a bare `flex-1` utility
          class alone isn't enough here).

          Gap consistency (per explicit request — rows and columns both
          16px): the outer `flex flex-col gap-4` below already puts 16px
          between Customer Overview and the split row. `.lyra-card-split`'s
          own shared rule (lyra-tokens.css) defaults to `gap: 1.5rem`
          (24px) — correct for its other consumers, but inconsistent with
          this 16px if left alone. Overridden here via an inline `style`
          (not a Tailwind class) specifically because `.lyra-card-split`'s
          `gap` comes from a plain CSS class, not a Tailwind utility —
          `cn()`/`tailwind-merge` only dedupes genuine Tailwind utility
          conflicts, so a `gap-4` class alongside `lyra-card-split` would
          just tie in specificity with it and depend on stylesheet source
          order to win, the exact fragility CONTRIBUTING.md already warns
          about elsewhere in this file. An inline style has no such
          ambiguity — it always wins. Applies identically whether the row
          is side-by-side or (≤480px) stacked to a column, since inline
          styles aren't scoped to a breakpoint the way the shared class's
          own `@container` rule is — 16px either way, matching the 16px
          above it. */}
      {activeTab === CUSTOMER_PANEL_TABS.indexOf("Overview") && (
        <div className="px-4 py-3 flex flex-col gap-4">
          {/* Customer Overview now sits directly LEFT of a stacked Latest
              Interaction/Latest Note column (per explicit request) — was a
              full-width block on its own row above that pair, back when
              Latest Interaction and Latest Note were side-by-side beneath
              it instead of stacked. Reuses the same `.lyra-card-split-wrap`/
              `.lyra-card-split`/`.lyra-card-split-even` family the two-
              column Latest Interaction/Latest Note row already used for "a
              couple of regions side by side, stacking once the container's
              own width gets tight" (see that modifier's own doc comment in
              lyra-tokens.css) — just with two DIFFERENT regions as the
              row's two children now: this Accordion on the left, and the
              new stacked wrapper below on the right, rather than each half
              being one Accordion the way the old row was. Its ≤480px
              stacking threshold still fits here: at the panel's normal
              resizable width (~325–425px) it stacks to a column (Customer
              Overview on top, matching the old top-to-bottom reading order),
              and `allowFullScreen`'d width stays comfortably side by side. */}
          <div className="lyra-card-split-wrap">
            <div className="lyra-card-split" style={{ gap: "1rem" }}>
              {/* Customer Overview field list. Wrapped in a neutral
                  container (`bg-lyra-bg-control-subtle`, rounded) per
                  CONTRIBUTING.md's "Composing panel body content"
                  convention, rather than sitting flush against the panel
                  background — the convention to follow for any future
                  card-like block added here, not a one-off choice for this
                  block alone. Collapsible via lyra-ui's `Accordion` (single
                  item, open by default) rather than a plain static block,
                  so the panel can be collapsed once read.

                  Height-matching now goes BOTH ways, per explicit follow-up
                  request — this used to stay unconditionally `h-fit` (its
                  own natural content height, from `CUSTOMER_INFO_ACCORDION_
                  CLASSNAME`) on the assumption its own field list was
                  reliably the taller side, with only the stacked column on
                  the right ever growing to match it. That assumption broke
                  once "View All Contacts" made the right column taller
                  for some customers — so this now clears `h-fit` to
                  `h-auto` (via `customerOverviewOpen`, controlled the same
                  way `latestNoteOpen` is — see that state's own comment)
                  whenever it's open, letting the row's own default
                  `align-items: stretch` size it to match whichever side is
                  actually taller, same mechanism the stacked wrapper below
                  already relied on for the other direction. Stays `h-fit`
                  while collapsed (same reasoning `latestNoteOpen`'s own gate
                  documents) so collapsing this card doesn't leave it
                  stretched into a tall box with a dead gap below its closed
                  header row. */}
              <Accordion
                className={cn(
                  CUSTOMER_INFO_ACCORDION_CLASSNAME,
                  "lyra-card-split-even",
                  customerOverviewOpen && "h-auto"
                )}
                value={customerOverviewAccordionValue}
                onValueChange={setCustomerOverviewAccordionValue}
                items={[
                  {
                    id: "customer-overview",
                    title: "Customer Overview",
                    content: (
                      <div className="flex flex-col gap-3">
                        {/* Channel launch buttons + Edit, together in one row
                            above the field list — per explicit request
                            ("move the contact icon buttons into the customer
                            overview and put them next to the edit button in
                            a row above the other information"). Previously
                            the channel buttons lived in the panel/tab
                            header's own `headerActions`/`actions`
                            (`CustomerRowInfoPanel`/`CustomerFullScreenTabContent`
                            — see each call site's own doc comment on `row`/
                            `onStartInteraction` below) and Edit sat alone
                            below the LAST field row; both now share this one
                            row instead. Only rendered while NOT editing —
                            same reasoning the Edit button itself already
                            had (see `allowOverviewEdit`'s own doc comment):
                            once editing starts, Save/Cancel in the footer
                            are the only way back out, and launching a new
                            channel mid-edit would be a confusing detour.
                            `justify-between` splits the channel buttons
                            (left) from Edit (right) — matches the reference
                            screenshot's layout. */}
                        {((row && !overviewEditing) || (allowOverviewEdit && !overviewEditing)) && (
                          <div className="flex items-center justify-between gap-2">
                            {/* `gap-1` (4px) between the channel buttons
                                themselves — per explicit request ("make the
                                gap between the buttons 4px") — distinct from
                                the wrapping row's own `gap-2`/`justify-
                                between`, which is the (much larger) space
                                between this whole button cluster and Edit. */}
                            <div className="flex items-center gap-1">
                              {row && (
                                <CustomerAddChannelButton
                                  row={row}
                                  isNarrow={false}
                                  onStartInteraction={onStartInteraction!}
                                />
                              )}
                            </div>
                            {allowOverviewEdit && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => onOverviewEditingChange(true)}
                                className="gap-1.5"
                              >
                                <Pencil className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
                                Edit
                              </Button>
                            )}
                          </div>
                        )}
                        {draft.overviewFields.map((field, index) => (
                          <div key={field.label} className="flex flex-col gap-3">
                            {overviewEditing ? (
                              // Standard, vertical (label-above-field) form
                              // fields while editing — per explicit
                              // follow-up request, no longer the read-only
                              // row's own "label left, value right"
                              // horizontal layout. Each field component
                              // supplies its own `label` now (rendered
                              // above the field by the component itself),
                              // so there's no separate standalone `Label`
                              // here the way the read-only row below still
                              // has. "Phone #"/"Email" specifically use the
                              // real `PhoneInput`/`EmailInput` components
                              // (per explicit request) rather than a plain
                              // `Input` — `PhoneInput` needs a `PhoneValue`,
                              // not the plain string `overviewFields`
                              // stores, so it round-trips through
                              // `phoneValueFromDisplay`/`phoneDisplayFromValue`
                              // (agent-next-gen-shared-utils.ts) on the way
                              // in/out; `EmailInput` already takes/returns a
                              // plain string, same as `overviewFields`
                              // itself, so no conversion is needed there.
                              field.label === "Phone #" ? (
                                <PhoneInput
                                  label={field.label}
                                  value={phoneValueFromDisplay(field.value)}
                                  onChange={(phone) => onOverviewFieldChange(index, phoneDisplayFromValue(phone))}
                                />
                              ) : field.label === "Email" ? (
                                <EmailInput
                                  label={field.label}
                                  value={field.value}
                                  onChange={(value) => onOverviewFieldChange(index, value)}
                                />
                              ) : (
                                <Input
                                  label={field.label}
                                  value={field.value}
                                  onChange={(e) => onOverviewFieldChange(index, e.target.value)}
                                />
                              )
                            ) : (
                              // `whitespace-nowrap` (previously on the value
                              // span below) was a real, shipped bug — lyra-ui's
                              // own reference for this exact row shape
                              // (Input.stories.tsx's "Label Horizontal With
                              // Separator") has no such override and wraps a
                              // long value fine by default; this app-level
                              // copy added `whitespace-nowrap` on top of it,
                              // which forced even a normal multi-word value
                              // onto one line and let it silently overflow
                              // past the panel's own right edge. Removed, plus
                              // `break-words` (wraps a value with no spaces at
                              // all to break too, e.g. a long email address —
                              // default word-wrapping alone only breaks at
                              // space boundaries, which a single unbroken
                              // string like an email has none of) and
                              // `min-w-0` on the value span (a flex item's
                              // default `min-width: auto` refuses to shrink
                              // below its own unwrapped content width no
                              // matter what wrapping rule is set, which would
                              // silently defeat `break-words` on its own).
                              // `<Label>` gets `flex-shrink-0` so it keeps its
                              // own natural single-line width and only the
                              // value column ever wraps.
                              <div className="flex items-start justify-between gap-4">
                                <Label label={field.label} className="flex-shrink-0" />
                                <span className="lyra-body-md text-lyra-fg-secondary break-words min-w-0">
                                  {/* Only "Phone #" is ever phone-shaped here
                                      — `formatPhoneForDisplay` is scoped to
                                      that one field (rather than applied to
                                      every row unconditionally) so an
                                      unrelated all-digit value (e.g. a zip
                                      code) is never mistaken for a phone
                                      number and reformatted incorrectly. */}
                                  {field.label === "Phone #" ? formatPhoneForDisplay(field.value) : field.value}
                                </span>
                              </div>
                            )}
                            {!overviewEditing && index < draft.overviewFields.length - 1 && <Separator />}
                          </div>
                        ))}
                      </div>
                    ),
                  },
                ]}
              />

              {/* Latest Interaction stacked directly ABOVE Latest Note (per
                  explicit request) — was side-by-side with it in its own
                  row below Customer Overview before; now the two share this
                  plain flex column instead, which is itself the second
                  (right) child of the Customer Overview split row above.
                  `lyra-card-split-even` goes on THIS wrapper (a direct
                  child of `.lyra-card-split`), not on the two Accordions
                  inside it — they're no longer direct children of the split
                  row themselves, just plain stacked flex-column children.

                  `align-items: stretch` (the split row's own default)
                  stretches this wrapper's HEIGHT to match the row's cross
                  size — since it has no explicit height of its own to opt
                  out with, unlike each side's own Accordion, which opts
                  BACK out to `h-fit` whenever collapsed (Customer Overview's
                  own `customerOverviewOpen`/Latest Note's own
                  `latestNoteOpen` gates — see each Accordion's own comment).
                  While open, the row's cross size is simply the max of the
                  two sides' natural content heights, and BOTH sides now grow
                  to match it (Customer Overview via the row's cross axis
                  directly, this wrapper's own stacked column via Latest
                  Note's `flex-1` below) — so whichever side is actually
                  taller for a given customer, the other one grows to match
                  it, not just one fixed "always taller" side. That alone
                  only gets the outer wrapper box to the right total height,
                  though — a plain `flex-col` of two natural-height
                  Accordions doesn't automatically grow its own children to
                  fill that extra space, so without more, the wrapper would
                  just end in blank unbordered space below Latest Note
                  instead of the two columns visually lining up (confirmed
                  live — this was the very next thing reported). Latest
                  Note's own `flex-1` (see that Accordion's own comment
                  below) is what actually closes that gap, growing ITS
                  bordered box to absorb the leftover height so the stack's
                  own bottom edge lines up with Customer Overview's — same
                  "stretch a card's own box to fill available height, even
                  past its natural content" mechanism this file's own
                  `bothCardsOpen`/`h-auto` used for the two cards' old
                  side-by-side row, just applied to one trailing card in a
                  column instead of two peer cards in a row. */}
              <div className="flex flex-col gap-4 lyra-card-split-even">
                {/* Its trigger renders the "Latest Interaction" title
                    itself — no hand-styled label needed here at all, which
                    also fixes an earlier mistake: that label used to be a
                    hand-built `uppercase tracking-wide` span, applying an
                    all-caps CSS transform to change how it displayed
                    instead of just typing it correctly — exactly the thing
                    CONTRIBUTING.md §17 ("Field label casing") says not to
                    do ("don't add `text-transform`; type the label text
                    correctly to begin with"). Typing the string as
                    `"Latest Interaction"` (already correct Title Case) and
                    letting the shared component's own typography render it
                    is the fix, not restyling it further.

                    Content itself comes from `latestInteraction` (built by
                    `buildLatestInteraction`) rather than one fixed
                    placeholder blurb — see that function's own doc comment
                    for why (it used to be the exact same "Asked about
                    upgrading her plan..." summary for every customer,
                    gendered pronoun and all, regardless of who was actually
                    open).

                    Status used to render as its own pill `Badge` sitting to
                    the right of the timestamp line — reverted per explicit
                    request (a filled pill there read as too visually loud/
                    noticeable). Now a plain second line directly below the
                    timestamp: a small circle `Badge` dot (`shape="circle"
                    dot"`, colored via `statusVariant` the same semantic-role
                    vocabulary `ContactHistoryStatusVariant`/Contact
                    History's own status dots already use) plus the status
                    name as plain text next to it — quieter than a filled
                    pill, same "dot + label" idiom already established
                    elsewhere in this file. */}
                <Accordion
                  className={CUSTOMER_INFO_ACCORDION_CLASSNAME}
                  defaultValue="latest-interaction"
                  items={[
                    {
                      id: "latest-interaction",
                      title: "Latest Interaction",
                      content: (
                        <div className="flex flex-col gap-3">
                          <div className="flex flex-col gap-1">
                            <span className="inline-flex items-center gap-1.5 lyra-body-sm text-lyra-fg-secondary">
                              <Clock className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
                              {latestInteraction.timeAgo} · {latestInteraction.channel}
                            </span>
                            <span className="inline-flex items-center gap-1.5 lyra-body-sm text-lyra-fg-secondary">
                              <Badge shape="circle" dot size="sm" variant={latestInteraction.statusVariant} aria-hidden="true" />
                              {latestInteraction.status}
                            </span>
                          </div>
                          <p className="lyra-body-md text-lyra-fg-default">{latestInteraction.summary}</p>
                          <span className="lyra-body-sm text-lyra-fg-secondary">
                            {latestInteraction.caseId} · Handled by {latestInteraction.handledBy}
                          </span>
                          {/* Deep link: the single most common history lookup
                              ("what happened last time?") in ONE click from the
                              panel's landing tab — opens the newest past
                              session's conversation as a tab in the
                              INTERACTION SPACE (record header), full reading
                              width, per explicit request. Only rendered when
                              the owner wired it (real side panel, not the
                              hover preview) and entries exist. */}
                          {onOpenConversation && customerHistoryEntries.length > 0 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="self-start"
                              onClick={() => onOpenConversation(customerHistoryEntries[0])}
                            >
                              Open Conversation
                              <ChevronRight className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
                            </Button>
                          )}
                          {/* "View All Contacts" — per explicit
                              request, an outline button (visually distinct
                              from "Open Conversation"'s own plain `ghost`
                              styling right above it) that switches this
                              same panel over to its "Contacts" tab
                              rather than opening a separate one — see
                              `onViewAllInteractions`'s own doc comment for
                              why its gate (`recordId`) differs from "Open
                              Conversation"'s (`customerHistoryEntries.
                              length > 0`). */}
                          {onViewAllInteractions && recordId && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="self-start"
                              onClick={onViewAllInteractions}
                            >
                              View All Contacts
                            </Button>
                          )}
                        </div>
                      ),
                    },
                  ]}
                />

                {/* Latest Note — directly below Latest Interaction (per
                    explicit request). Same neutral-container + collapsible-
                    Accordion treatment as Latest Interaction above it (see
                    that block's own comments for the container/collapsible
                    rationale — applies identically here), synthesized by
                    `buildLatestNote` the same deterministic-per-customer
                    way. No status `Badge` here — notes don't carry a
                    resolution status the way an interaction does — just the
                    author + relative time, same placement
                    `latestInteraction`'s case-id/handled-by line uses.

                    `flex-1` (only while open — see `latestNoteOpen`) is
                    what actually makes the stacked column's own stretched
                    height (from the split row's `align-items: stretch`,
                    see the wrapper's own comment above) show up as a real,
                    visibly-taller bordered box instead of invisible space
                    below it — growing THIS card, specifically, rather than
                    Latest Interaction above it, so the trailing card in the
                    stack is the one that absorbs the leftover height,
                    matching Customer Overview's own bottom edge. `h-auto`
                    alongside it clears `CUSTOMER_INFO_ACCORDION_CLASSNAME`'s
                    own `h-fit` for the same reason it did on the two cards'
                    old side-by-side row (see that history for the full
                    "h-fit silently overriding stretch" explanation) — this
                    is a flex-COLUMN growing on the main axis (height) this
                    time rather than a flex-ROW stretching on the cross axis,
                    but an explicit `h-fit` risks the same kind of fight
                    with the flex algorithm either way, so it's cleared here
                    too rather than assumed harmless. */}
                <Accordion
                  className={cn(CUSTOMER_INFO_ACCORDION_CLASSNAME, latestNoteOpen && "flex-1 h-auto")}
                  value={latestNoteAccordionValue}
                  onValueChange={setLatestNoteAccordionValue}
                  items={[
                    {
                      id: "latest-note",
                      title: "Latest Note",
                      content: (
                        <div className="flex flex-col gap-3">
                          <span className="inline-flex items-center gap-1.5 lyra-body-sm text-lyra-fg-secondary">
                            <FileText className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
                            {latestNote.timeAgo}
                          </span>
                          <p className="lyra-body-md text-lyra-fg-default">{latestNote.note}</p>
                          <span className="lyra-body-sm text-lyra-fg-secondary">By {latestNote.author}</span>
                        </div>
                      ),
                    },
                  ]}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === CUSTOMER_PANEL_TABS.indexOf("Copilot") && (
        <CopilotTabContent summary={copilotSummary} extra={copilotExtra} />
      )}

      {activeTab === CUSTOMER_PANEL_TABS.indexOf("Contacts") && recordId && (
        // `relative flex flex-1 min-h-0 overflow-hidden` — restored (was
        // briefly simplified away to plain `relative` while chasing what
        // turned out to be an unrelated bug one level up — see the outer
        // wrapper's own comment above). This is the shape that was always
        // intended: a flex ROW, bounded to this tab's own share of the
        // panel's real available height (`min-h-0` off the now-reliably-
        // definite `h-full` chain above).
        //   - `relative` gives `CustomerHistorySessionDetailPanel` (a
        //     right-docked `InteriorPanel`) the positioning context it
        //     needs to dock within THIS box specifically, not the whole
        //     app shell.
        //   - At this panel's normal docked/popover widths (well under
        //     `InteriorPanel`'s own 1024px `isNarrow` threshold), that
        //     panel renders via its absolute-overlay branch — floating on
        //     TOP of the list below, not pushing it down, and (now that
        //     this box has a real bounded height instead of an arbitrary
        //     content-driven one) sized to the actual visible area instead
        //     of the full unscrolled list height — which is what was
        //     causing the reported "double scroll"/cut-off-with-room-to-
        //     spare symptoms: an absolutely-positioned `h-full` matching a
        //     content-driven ancestor's height is exactly as tall as ALL
        //     the (possibly very long) list content, not the viewport.
        //   - At real full-screen width (≥1024px, `allowFullScreen`'d),
        //     that same panel switches to its normal inline branch instead
        //     — and because THIS wrapper is a flex ROW (not a plain block),
        //     that inline panel sits beside `CustomerHistoryTabContent` as
        //     a true side-by-side dock, not stacked below it (a plain
        //     block wrapper, as this briefly was, stacks block children
        //     vertically instead — confirmed live as the "session details
        //     opening below the list in full screen" report).
        //   - `CustomerHistoryTabContent`'s own `flex-1 min-h-0 overflow-
        //     hidden` root (see that component) is what then gives its
        //     list a real box to scroll independently WITHIN — a single
        //     scroll, not the double-scroll this box's earlier, unbounded
        //     `relative`-only version produced (list content overflowing
        //     into the page's own scroll AND the detail panel separately
        //     trying to scroll its own oversized box).
        <div className="relative flex flex-1 min-h-0 overflow-hidden">
          <CustomerHistoryTabContent
            entries={customerHistoryEntries}
            selectedIndex={selectedHistoryIndex}
            onSelectIndex={setSelectedHistoryIndex}
          />
          <CustomerHistorySessionDetailPanel
            entry={selectedHistoryEntry}
            onClose={() => setSelectedHistoryIndex(null)}
            onPrevious={() => handleHistoryNav(-1)}
            onNext={() => handleHistoryNav(1)}
            hasPrevious={selectedHistoryIndex !== null && selectedHistoryIndex > 0}
            hasNext={selectedHistoryIndex !== null && selectedHistoryIndex < customerHistoryEntries.length - 1}
          />
        </div>
      )}

      {activeTab === CUSTOMER_PANEL_TABS.indexOf("Detail") && (
        /* `draft.overviewFields`, not the raw `fields` prop — the Detail
           tab's own readonly Contact #/Total Balance/Address 1/City/
           State/Zip Code duplicates now track whatever the Overview tab's
           editable copy of those same fields currently holds (including a
           still-pending, not-yet-saved edit), not the original synthesized
           snapshot — see `CustomerRecordDraft.overviewFields`'s own doc
           comment for why these needed to stop pointing at two different
           copies of the same values. */
        <CustomerDetailTabContent fields={draft.overviewFields} draft={draft} onDraftChange={onDraftChange} />
      )}

      {/* No notes source yet (a customer-data seam); the tab says so rather than rendering blank. */}
      {activeTab === CUSTOMER_PANEL_TABS.indexOf("Notes") && (
        <p className="lyra-body-md text-lyra-fg-secondary" data-slot="customer-notes-empty">
          {t("No notes on this customer yet.")}
        </p>
      )}

      {activeTab === CUSTOMER_PANEL_TABS.indexOf("Directory") && (
        <CustomerDirectoryTabContent draft={draft} onDraftChange={onDraftChange} onPhoneChange={onPhoneChange} />
      )}
    </div>
  );
}
