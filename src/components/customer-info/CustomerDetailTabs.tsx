// The Customer Information panel's Detail and Directory tabs, the record
// draft behind their Save/Cancel footer, and the Copilot tab (P-EXTRACT C7).
import { useState, useEffect } from "react";
import {
  Button,
  Accordion,
  type SelectOption,
  Input,
  Checkbox,
  Select,
  DatePicker,
  type PhoneValue,
  PhoneInput,
  RadioGroup,
  RadioGroupItem,
  EmailInput,
  PanelFooter,
} from "@nicecxone/lyra-ui";
import { Bookmark } from "lucide-react";
import { splitCustomerName, phoneValueFromDisplay } from "@/components/agent-next-gen-shared-utils";
import {
  CUSTOMER_INFO_ACCORDION_CLASSNAME,
  getFieldValue,
  type CustomerInfoField,
  type CopilotSummary,
} from "./customer-info-seed";

const CUSTOMER_DETAIL_ACCOUNT_BLOCK_OPTIONS: SelectOption[] = [
  { value: "none", label: "None" },
  { value: "collections", label: "Collections" },
  { value: "fraud-review", label: "Fraud Review" },
  { value: "credit-hold", label: "Credit Hold" },
];

/* ── CustomerDetailTabContent ──
   The "Detail" tab's field-editor form (per a reference screenshot of a
   legacy admin contact-edit page) — two collapsible `Accordion` sections,
   "General" and "Address", both open by default, each a responsive
   `.lyra-form-grid` of real lyra-ui field components (`Input`/`Select`/
   `Checkbox`/`DatePicker`), same "Accordion wrapping real editable fields"
   composition `FormTemplate`'s own "Placement Information" section already
   demonstrates (form-template.tsx) — not a hand-rolled bordered box imitating
   one. `lyra-form-grid-wrap` on the root establishes the container-query
   boundary `.lyra-form-grid` needs (see that class's own doc comment in
   lyra-tokens.css): each row is 2-up at this component's own full width,
   stepping down to a single column well before an `InteriorPanel`'s
   typical ~250–425px width would otherwise crowd two fields onto one line.

   Reference screenshot's field labels were all-caps ("CONTACT #", "FIRST
   NAME") — that's the *legacy* admin app's own styling, not something to
   replicate via CSS `text-transform` (CONTRIBUTING.md §17 already covers
   exactly this mistake). Labels here are typed in normal case and rendered
   through each field component's own built-in label, same as every other
   field in this panel/app.

   Fields with a real source reuse it instead of inventing a second,
   possibly-disagreeing value: "Contact #"/"Total Balance"/"Address
   1"/"City"/"State"/"Zip Code" come straight from `fields` (the same
   per-customer data `buildCustomerInfoFields` already computed for the
   Overview tab — see `getFieldValue` above), and "First Name"/"Last Name"
   are seeded from `customerName` the same way `buildCustomerInfoFields`'s
   own synthesized email does (`splitCustomerName`) — done once, at draft-
   build time (`buildCustomerRecordDraft` below), not derived fresh every
   render here. Everything else in the reference screenshot (Original
   Contact #, Title, Department, Balance Due, Account Block, Group, Due
   Date, Address 2) has no real or synthesized source anywhere in this
   app's data, so those stay at the screenshot's own shown defaults (empty
   / "None" / unchecked-false where shown, "$0.00" for Balance Due
   specifically since it's a distinct "amount currently owed" concept from
   Total Balance, not just a repeat of it).

   Every editable field here is now CONTROLLED via `draft`/`onDraftChange`
   (a `CustomerRecordDraft` + patch-merge setter, both owned by
   `useCustomerRecordDraft` — see that hook's own doc comment) rather than
   this component's own local `useState` per field, per explicit request
   for a Save/Cancel footer: this component used to unmount (losing all
   its local state) the moment the agent switched away from the Detail tab
   (see the `activeTab === ... &&` conditional render in
   `CustomerInformationPanelBody`), which made "pending, revertible edits
   that survive a tab switch" impossible without lifting the values out of
   here first. Still "not wired to persistence" in the sense that matters
   for a prototype (no backend call on Save) — just no longer "silently
   discarded on tab switch" either. */
export function CustomerDetailTabContent({
  fields,
  draft,
  onDraftChange,
}: {
  fields: CustomerInfoField[];
  draft: CustomerRecordDraft;
  onDraftChange: (patch: Partial<CustomerRecordDraft>) => void;
}) {
  // Same neutral bordered-container treatment as the Overview tab's
  // "Customer Overview"/"Latest Interaction" accordions (see
  // `CustomerInformationPanelBody`) — each section gets its own card-like
  // container rather than the two sharing one borderless `Accordion` root,
  // so "General" and "Address" read as distinct blocks instead of one long
  // list. Split into two single-item `Accordion`s (each still open by
  // default via its own `defaultValue`) instead of the previous single
  // `type="multiple"` root, since that's what separate containers require —
  // each item now toggles independently by construction, the same behavior
  // `type="multiple"` was providing before.
  return (
    <div className="flex flex-col gap-4 px-4 pt-3 pb-4 lyra-form-grid-wrap">
      <Accordion
        defaultValue="general"
        className={CUSTOMER_INFO_ACCORDION_CLASSNAME}
        items={[
          {
            id: "general",
            title: "General",
            content: (
              <div className="flex flex-col gap-4">
                <div className="lyra-form-grid">
                  <Input label="Contact #" value={getFieldValue(fields, "Contact #")} readonly />
                  <Input
                    label="Original Contact #"
                    value={draft.originalContactNumber}
                    onChange={(e) => onDraftChange({ originalContactNumber: e.target.value })}
                  />
                </div>
                <div className="lyra-form-grid">
                  <Input label="First Name" value={draft.firstName} onChange={(e) => onDraftChange({ firstName: e.target.value })} />
                  <Input label="Last Name" value={draft.lastName} onChange={(e) => onDraftChange({ lastName: e.target.value })} />
                </div>
                <div className="lyra-form-grid">
                  <Input label="Title" value={draft.title} onChange={(e) => onDraftChange({ title: e.target.value })} />
                  <Input label="Department" value={draft.department} onChange={(e) => onDraftChange({ department: e.target.value })} />
                </div>
                <div className="lyra-form-grid">
                  <Input label="Total Balance" value={getFieldValue(fields, "Balance")} readonly />
                  <Input label="Balance Due" value={draft.balanceDue} onChange={(e) => onDraftChange({ balanceDue: e.target.value })} />
                </div>
                <div className="lyra-form-grid">
                  <Checkbox
                    label="Active"
                    checked={draft.active}
                    onCheckedChange={(checked) => onDraftChange({ active: checked === true })}
                  />
                  <Select
                    label="Account Block"
                    options={CUSTOMER_DETAIL_ACCOUNT_BLOCK_OPTIONS}
                    value={draft.accountBlock}
                    onValueChange={(value) => onDraftChange({ accountBlock: value })}
                  />
                </div>
                <div className="lyra-form-grid">
                  <Select
                    label="Group"
                    options={[]}
                    value={draft.group}
                    onValueChange={(value) => onDraftChange({ group: value })}
                    placeholder="Select group"
                  />
                  <DatePicker label="Due Date" value={draft.dueDate} onChange={(date) => onDraftChange({ dueDate: date })} />
                </div>
              </div>
            ),
          },
        ]}
      />
      <Accordion
        defaultValue="address"
        className={CUSTOMER_INFO_ACCORDION_CLASSNAME}
        items={[
          {
            id: "address",
            title: "Address",
            content: (
              <div className="flex flex-col gap-4">
                <div className="lyra-form-grid">
                  <Input label="Address 1" value={getFieldValue(fields, "Address")} readonly />
                  <Input label="Address 2" value={draft.address2} onChange={(e) => onDraftChange({ address2: e.target.value })} />
                </div>
                <div className="lyra-form-grid">
                  <Input label="City" value={getFieldValue(fields, "City")} readonly />
                  <Input label="State" value={getFieldValue(fields, "State")} readonly />
                </div>
                <div className="lyra-form-grid">
                  <Input label="Zip Code" value={getFieldValue(fields, "Zip Code")} readonly />
                </div>
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}

const CUSTOMER_DIRECTORY_BLOCK_OPTIONS = [
  { value: "no-block", label: "No Block" },
  { value: "block-daily", label: "Block Daily" },
  { value: "block-permanent", label: "Block Permanent" },
];

/** Total phone slots the Directory tab renders — "up to 10 phones" per the
 *  reference screenshot: the first is always labeled "Home", the rest
 *  "Phone 2" through "Phone 10". */
const CUSTOMER_DIRECTORY_PHONE_COUNT = 10;
const CUSTOMER_DIRECTORY_PHONE_LABELS = Array.from({ length: CUSTOMER_DIRECTORY_PHONE_COUNT }, (_, i) =>
  i === 0 ? "Home" : `Phone ${i + 1}`
);

export interface CustomerDirectoryPhoneState {
  phone: PhoneValue;
  consentCall: boolean;
  consentSms: boolean;
  block: string;
}

/* ── CustomerDirectoryPhoneRow ──
   One phone slot's worth of fields, its own little self-contained block —
   pulled out of `CustomerDirectoryTabContent` (rather than inlined in a
   `.map`) so each of the up to 10 rows below owns independent `useState`
   the normal way a component does, instead of ten parallel array-indexed
   state slots in the parent needing hand-rolled per-index update
   functions for every field. Same "Call Attempts Today/Total" read-only
   stat pair for every row (there's no live call-attempt tracking in this
   demo, same static-`0` status as `Thread.messageCount`
   elsewhere) — plain text, not `Metric`/`DashboardCardMetric`, since those
   render a large headline figure + caption meant for a dashboard card,
   not a compact inline stat under a phone field.

   Each slot is its own single-item `Accordion` (title = the slot label,
   e.g. "Home"/"Phone 2") — collapsible per request, `defaultValue={label}`
   so every slot still starts open (same "collapsible but open by default"
   convention as the Overview tab's own "Latest Interaction" accordion).
   `PhoneInput` no longer gets its own `label` prop: the accordion's own
   trigger already shows the slot name as its title immediately above the
   field, so a second, identical label directly under it was pure
   duplication (confirmed from a screenshot of the pre-accordion layout —
   "Home" as a plain heading, then "Home" again as the phone field's own
   label right below it).

   No divider of its own on this row — `Accordion`'s own per-item
   `border-b` (accordion.tsx, rendered after every item's content)
   supplies the hairline between consecutive slots; `CustomerDirectory
   TabContent` adds one `border-t` above the whole list of rows for the
   divider separating it from the Email/Consent block, rather than every
   row duplicating that same top border (which used to visually double up
   with the row-before's own bottom divider).

   Controlled via `state`/`onChange` (a patch-merge setter into this
   slot's own `CustomerDirectoryPhoneState`) rather than its own local
   `useState` seeded from a `defaultState` prop — same "lifted into
   `useCustomerRecordDraft`, survives a tab switch, drives the Save/Cancel
   footer" reasoning `CustomerDetailTabContent`'s own doc comment covers,
   just per-phone-slot instead of per-field. */
function CustomerDirectoryPhoneRow({
  label,
  state,
  onChange,
}: {
  label: string;
  state: CustomerDirectoryPhoneState;
  onChange: (patch: Partial<CustomerDirectoryPhoneState>) => void;
}) {
  return (
    <Accordion
      type="single"
      defaultValue={label}
      // Same neutral bordered-container treatment as the Overview tab's
      // "Customer Overview"/"Latest Interaction" accordions and the Detail
      // tab's "General"/"Address" accordions (see those components' own
      // comments) — each phone slot now reads as its own card instead of a
      // borderless row, consistent across all three tabs.
      className={CUSTOMER_INFO_ACCORDION_CLASSNAME}
      items={[
        {
          id: label,
          title: label,
          content: (
            // Three columns — phone + its call-attempt stats, consent
            // checkboxes, block radios — share one `.lyra-form-grid` row.
            // `.lyra-form-grid` already handles any number of children
            // evenly (`> *` gets `flex: 1 1 0%` by default — no
            // per-consumer modifier needed, unlike `.lyra-card-split`'s
            // `-even`, see that class's own doc comment in
            // lyra-tokens.css for why the two families differ here), and
            // reacts off the same `.lyra-form-grid-wrap` boundary this
            // row's ancestor (`CustomerDirectoryTabContent`'s root div)
            // already establishes — full width (e.g. `allowFullScreen`'d)
            // reads as a real 3-up row per the reference screenshot, this
            // panel's normal ~350–425px resizable width stacks to one
            // column same as before this existed.
            <div className="lyra-form-grid">
              <div className="flex flex-col gap-3">
                {/* `max-w-sm` (384px) — same convention as the Directory
                    tab's `EmailInput` above (see its own comment): caps a
                    single full-width-by-default field at a sane reading
                    width via the standing `className` passthrough, rather
                    than letting it stretch to fill this column's full
                    (already only ~1/3-row) width. */}
                <PhoneInput value={state.phone} onChange={(phone) => onChange({ phone })} className="max-w-sm" />
                <div className="flex flex-col gap-1">
                  <span className="lyra-body-md-emphasis text-lyra-fg-default">Call Attempts Today: 0</span>
                  <span className="lyra-body-md-emphasis text-lyra-fg-default">Call Attempts Total: 0</span>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Checkbox
                  label="Consent Call"
                  checked={state.consentCall}
                  onCheckedChange={(c) => onChange({ consentCall: c === true })}
                />
                <Checkbox
                  label="Consent SMS"
                  checked={state.consentSms}
                  onCheckedChange={(c) => onChange({ consentSms: c === true })}
                />
              </div>
              <RadioGroup value={state.block} onValueChange={(block) => onChange({ block })} className="gap-2">
                {CUSTOMER_DIRECTORY_BLOCK_OPTIONS.map((option) => (
                  <RadioGroupItem key={option.value} value={option.value} label={option.label} />
                ))}
              </RadioGroup>
            </div>
          ),
        },
      ]}
    />
  );
}

/* ── CustomerDirectoryTabContent ──
   The "Directory" tab (per a reference screenshot of a legacy admin
   contact-edit page): an `EmailInput` + a standalone consent `Checkbox` at
   the top, then up to 10 phone slots (`CustomerDirectoryPhoneRow`),
   separated by a hairline divider between every section
   (`border-lyra-border-subtle`). The reference screenshot's own
   alternating shaded/unshaded rows were dropped on request — plain
   dividers only, no zebra striping.

   Reference screenshot's own field labels were all-caps ("EMAIL", "HOME") —
   same legacy-app-styling situation as the Detail tab's "CONTACT #" etc.
   (see `CustomerDetailTabContent`'s own doc comment and CONTRIBUTING.md
   §17): typed in normal case here and left to each field component's own
   built-in label typography, not forced uppercase via CSS.

   Only the "Home" row (the first phone slot) seeds from real data — the
   same `fields` "Phone #" this panel's Overview/Detail tabs already show
   (parsed back into a `PhoneValue` via `phoneValueFromDisplay`), with
   `consentCall`/`consentSms` defaulted true since it's the customer's
   already-established primary channel. "Phone 2" through "Phone 10" have
   no real or synthesized source (a customer doesn't have 10 real numbers
   in this app's data), so they start genuinely blank/unconsented, same as
   the reference screenshot shows them — see `buildCustomerRecordDraft`,
   which now owns seeding this same starting shape.

   Controlled via `draft`/`onDraftChange`/`onPhoneChange` (all three from
   `useCustomerRecordDraft`) rather than its own local `useState` — same
   "lifted so it survives a tab switch and can drive the Save/Cancel
   footer" reasoning as `CustomerDetailTabContent`'s own doc comment. */
export function CustomerDirectoryTabContent({
  draft,
  onDraftChange,
  onPhoneChange,
}: {
  draft: CustomerRecordDraft;
  onDraftChange: (patch: Partial<CustomerRecordDraft>) => void;
  onPhoneChange: (index: number, patch: Partial<CustomerDirectoryPhoneState>) => void;
}) {
  return (
    <div className="flex flex-col lyra-form-grid-wrap">
      <div className="flex flex-col gap-3 px-4 py-4">
        {/* `max-w-sm` (384px) — same "cap a single full-width-by-default
            field at a sane reading width" convention lyra-ui's own
            Storybook demos use for a lone `Input`/`EmailInput` outside a
            multi-column grid (`Input.stories.tsx`'s `max-w-[400px]`,
            `TagsInput`/`Textarea` stories' `max-w-sm`) — `EmailInput`
            itself has no dedicated width prop; `className` lands on its
            outer wrapper div (email-input.tsx) same as `Input`, so this is
            the standing way to constrain one rather than adding a new
            component prop for it. */}
        <EmailInput
          label="Email"
          value={draft.directoryEmail}
          onChange={(value) => onDraftChange({ directoryEmail: value })}
          className="max-w-sm"
        />
        <Checkbox
          label="Consent"
          checked={draft.emailConsent}
          onCheckedChange={(c) => onDraftChange({ emailConsent: c === true })}
        />
      </div>
      {/* Each phone slot is now its own bordered card
          (`CUSTOMER_INFO_ACCORDION_CLASSNAME` on the `Accordion` inside
          `CustomerDirectoryPhoneRow`), so this wrapper switches from a bare
          `border-t` + flush list (dividers supplied by each row's own
          bottom border) to a gap + padding, matching the Overview/Detail
          tabs' own card-stack spacing. */}
      <div className="flex flex-col gap-4 px-4 pt-3 pb-4">
        {CUSTOMER_DIRECTORY_PHONE_LABELS.map((label, i) => (
          <CustomerDirectoryPhoneRow
            key={label}
            label={label}
            state={draft.phones[i]}
            onChange={(patch) => onPhoneChange(i, patch)}
          />
        ))}
      </div>
    </div>
  );
}

/* ── Customer record draft (Detail/Directory Save/Cancel) ──
   Per explicit request: a Save/Cancel footer that animates into the
   bottom of the Customer Information panel whenever the Detail tab's
   fields or the Directory tab's email/consent/phone slots are edited,
   with Cancel reverting every pending edit. Before this, every one of
   those fields was its own local, uncontrolled `useState` inside
   `CustomerDetailTabContent`/`CustomerDirectoryTabContent`/
   `CustomerDirectoryPhoneRow` — which had two problems for this feature:
   (1) there was nowhere to observe "has anything changed" from outside
   those components, and (2) since the Detail/Directory tabs are only
   rendered while active (`activeTab === ... &&`, see
   `CustomerInformationPanelBody`), switching to a different tab UNMOUNTS
   them, silently discarding whatever was locally typed — no baseline to
   even revert TO. `CustomerRecordDraft` below is the whole editable
   surface lifted into one plain object; `useCustomerRecordDraft` owns it
   plus a separately-tracked saved baseline, so edits now survive tab
   switches and Cancel has something real to restore.

   `overviewFields` (added per a later explicit request) extends this same
   draft to also cover the Overview tab's own "Customer Overview" field
   list (Phone #/Contact #/Email/Balance/Address/City/State/Zip Code) —
   previously plain read-only display rows sourced straight from `fields`
   (`buildCustomerInfoFields`'s own synthesized output), with no edit
   affordance at all. A copy of `fields` at draft-build time, not `fields`
   itself: `fields` stays the immutable synthesized "as if freshly loaded"
   baseline the draft is SEEDED from (and what a Cancel effectively
   reverts back toward, via `savedDraft`), while `overviewFields` is the
   editable, saveable copy. `CustomerDetailTabContent`'s own read-only
   duplicates of some of these same values (Contact #/Total Balance/
   Address 1/City/State/Zip Code) now also read from THIS copy — see that
   component's own render call site — so a saved Overview edit doesn't go
   stale there. */
export interface CustomerRecordDraft {
  originalContactNumber: string;
  firstName: string;
  lastName: string;
  title: string;
  department: string;
  balanceDue: string;
  active: boolean;
  accountBlock: string;
  group: string;
  dueDate: Date | undefined;
  address2: string;
  directoryEmail: string;
  emailConsent: boolean;
  phones: CustomerDirectoryPhoneState[];
  overviewFields: CustomerInfoField[];
}

/** Builds a fresh draft's starting values for one customer record — same
 *  real-data-where-it-exists, blank-default-elsewhere split
 *  `CustomerDetailTabContent`/`CustomerDirectoryTabContent` used to seed
 *  their own local state with (see those components' own now-superseded
 *  doc comments for the field-by-field reasoning). */
function buildCustomerRecordDraft(fields: CustomerInfoField[], customerName?: string): CustomerRecordDraft {
  const { firstName, lastName } = splitCustomerName(customerName);
  const phoneDisplay = getFieldValue(fields, "Phone #");
  return {
    originalContactNumber: "",
    firstName,
    lastName,
    title: "",
    department: "",
    balanceDue: "$0.00",
    active: true,
    accountBlock: "none",
    group: "",
    dueDate: undefined,
    address2: "",
    directoryEmail: getFieldValue(fields, "Email"),
    emailConsent: false,
    phones: CUSTOMER_DIRECTORY_PHONE_LABELS.map((_, i) =>
      i === 0
        ? { phone: phoneValueFromDisplay(phoneDisplay), consentCall: true, consentSms: true, block: "no-block" }
        : { phone: { countryCode: "us", number: "" }, consentCall: false, consentSms: false, block: "no-block" }
    ),
    // Shallow copy — a fresh array/objects, not the same references
    // `fields` holds, so mutating this later (`updateOverviewField`) never
    // reaches back and mutates the caller's own `fields` prop.
    overviewFields: fields.map((field) => ({ ...field })),
  };
}

/** Owns one customer record's Detail/Directory draft plus its last-saved
 *  baseline — called independently by each of `CustomerInformationSidePanel`/
 *  `CustomerRowInfoPanel`/`CustomerInfoHoverPreview` (same "every consumer
 *  builds its own copy of shared per-customer state" convention `fields`/
 *  `latestInteraction`/etc. already use in this file), then threaded down
 *  into `CustomerInformationPanelBody` as a controlled prop. `isDirty`
 *  drives the Save/Cancel footer the two real panels render in their own
 *  `footer` slot — the hover preview doesn't render one (see its own call
 *  site) since it's a transient mouse-hover popover, not a place an agent
 *  parks pending edits.
 *
 *  `isDirty` is reference equality (`draft !== savedDraft`), not a deep
 *  compare: `save`/`cancel` both re-point one of the two state variables
 *  at the exact SAME object the other already holds (not a copy), so
 *  `isDirty` flips back to `false` the instant either fires; any actual
 *  field edit always produces a brand-new object via `updateDraft`'s own
 *  spread, so it can never be accidentally reference-equal to the
 *  baseline again until the next save/cancel. One accepted edge case from
 *  this simplification: editing a field back to its original value still
 *  reads as dirty (no per-field value diffing) — fine for this
 *  prototype's "no real persistence" fields, and better than the
 *  alternative (a real deep-equal on every keystroke across up to 10
 *  phone slots). */
export function useCustomerRecordDraft(
  fields: CustomerInfoField[],
  customerName: string | undefined,
  recordId: string | undefined
) {
  const [savedDraft, setSavedDraft] = useState(() => buildCustomerRecordDraft(fields, customerName));
  const [draft, setDraft] = useState(savedDraft);

  // A genuinely different record is now showing (switched customer/
  // interaction) — start ITS draft fresh rather than carrying over the
  // PREVIOUS record's pending edits (or stale dirty state) onto this one.
  // Keyed on `recordId` alone, not also `fields`/`customerName` — same
  // reasoning `CustomerRowInfoPanel`'s own `row?.contactNumber`-keyed
  // reset effect documents elsewhere in this file: those are fresh
  // object/value references most renders even for the SAME record, so
  // keying on them too would reset this far more often than intended.
  useEffect(() => {
    const fresh = buildCustomerRecordDraft(fields, customerName);
    setSavedDraft(fresh);
    setDraft(fresh);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordId]);

  const updateDraft = (patch: Partial<CustomerRecordDraft>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
  };
  const updatePhone = (index: number, patch: Partial<CustomerDirectoryPhoneState>) => {
    setDraft((prev) => ({
      ...prev,
      phones: prev.phones.map((phone, i) => (i === index ? { ...phone, ...patch } : phone)),
    }));
  };
  const updateOverviewField = (index: number, value: string) => {
    setDraft((prev) => ({
      ...prev,
      overviewFields: prev.overviewFields.map((field, i) => (i === index ? { ...field, value } : field)),
    }));
  };

  return {
    draft,
    isDirty: draft !== savedDraft,
    updateDraft,
    updatePhone,
    updateOverviewField,
    save: () => setSavedDraft(draft),
    cancel: () => setDraft(savedDraft),
  };
}

/** Save/Cancel footer for the Detail/Directory/Customer Overview tabs'
 *  pending edits — rendered by both `CustomerInformationSidePanel` and
 *  `CustomerRowInfoPanel` (each via their own `footer`/`InteriorPanel`-
 *  `footer` slot) whenever their own `useCustomerRecordDraft` reports
 *  `isDirty` OR the Customer Overview edit button has been clicked (see
 *  each call site's own `recordDraft.isDirty || overviewEditing` check),
 *  per explicit request: appears immediately on either trigger, not just
 *  once a field has actually changed, and stays open regardless of which
 *  tab the agent has since switched to — not scoped to Detail/Directory
 *  being the active tab — until Save or Cancel resolves it (same "keep it
 *  open until resolved" precedent the Agent Leg Disconnected toast
 *  already established). No "You have unsaved changes" copy — per a
 *  follow-up explicit request, the Cancel/Save buttons alone are the
 *  whole footer now (they already only ever appear together with nothing
 *  else in this slot, so the label was redundant). `animate-in
 *  slide-in-from-bottom-2 fade-in-0` gives it the requested "animates
 *  into the bottom of the panel" entrance; no matching exit animation —
 *  `footer`'s own conditional render already unmounts it immediately on
 *  Save/Cancel, same "entrance-only" treatment already used elsewhere in
 *  this file (e.g. the tab-switch "Coming soon" placeholder in
 *  `useSearchPanelContent`). */
export function CustomerRecordSaveFooter({ onSave, onCancel }: { onSave: () => void; onCancel: () => void }) {
  return (
    <PanelFooter className="animate-in slide-in-from-bottom-2 fade-in-0 duration-200">
      <Button variant="outline" size="md" onClick={onCancel}>
        Cancel
      </Button>
      <Button size="md" onClick={onSave}>
        Save
      </Button>
    </PanelFooter>
  );
}

/** Copilot tab content — per explicit request, shown whenever the panel's
 *  "Copilot" tab is active: a plain info box giving the agent a one-line
 *  reason the customer is reaching out, plus a "Journey Summary" card
 *  recapping what's led up to this contact. Both pulled from
 *  `buildCopilotSummary` (synthesized, same deterministic-per-customer
 *  approach as Overview's Latest Interaction/Latest Note — see that
 *  function's own doc comment). Purely a read-only recap — the actual
 *  "ask copilot something" affordance is the shared `AIInput` component
 *  (ai-input.tsx) — same component the Overview tab's own footer uses —
 *  pinned to the bottom of this same tab by its caller, not rendered
 *  inline here (see `CustomerInformationSidePanel`'s `footer` prop).
 *
 *  Per explicit follow-up request ("animate in the content in copilot
 *  sequentially after the copilot window opens"), the two blocks below
 *  reveal one after another rather than popping in together: each gets the
 *  same `animate-in fade-in-0 slide-in-from-bottom-1` entrance
 *  `CustomerRecordSaveFooter` above already established for this codebase,
 *  staggered via `tailwindcss-animate`'s `delay-*` utilities (a plain
 *  Tailwind `transitionDelay` scale that plugin also wires up as
 *  `animation-delay` for anything under `animate-in` — no custom CSS
 *  needed). This works as an "on open" reveal with no extra JS/state
 *  because `CopilotTabContent` is only ever mounted while the Copilot tab
 *  is actually active (see this component's call site's `activeTab ===
 *  ...&&` guard) — every fresh mount (tab opened, or landed on directly —
 *  see `copilotAvailable`'s own doc comment on the two places that now
 *  default straight to this tab) is a brand new entrance for the CSS
 *  animation classes to replay, with nothing to reset between opens.
 *
 *  `fill-mode-backwards` on both blocks fixes a flash reported live: by
 *  default `animate-in`'s `animation-fill-mode` is `none`, so during a
 *  `delay-*` (and even the split-second before a non-delayed animation's
 *  first frame paints) the browser renders the element in its plain,
 *  fully-visible resting state — THEN, once the animation actually starts,
 *  it jumps straight to the "from" keyframe (invisible/offset) before
 *  animating back to visible. That "briefly fully visible → sudden
 *  disappear → fade back in" sequence is what read as a flash, worst on the
 *  Journey Summary card since its whole `delay-300` window was spent fully
 *  visible first. `fill-mode-backwards` makes the element hold the "from"
 *  keyframe's styles for the ENTIRE time before its animation starts too,
 *  so both blocks stay invisible from first paint straight through their
 *  delay, with nothing to visually pop before the intended reveal.
 *  `duration-500`/`delay-300` (up from the original `duration-300`/
 *  `delay-150`) per the same follow-up request to slow the pacing down —
 *  a more clearly readable half-second fade+slide each, with a noticeable
 *  pause between the two rather than a rushed back-to-back flicker.
 *
 *  `extra` (per explicit follow-up request — the Marcus Webb scripted
 *  scenario, `AgentWorkspace2WithDeskPage.tsx`) renders BELOW the Journey
 *  Summary card, third in the same staggered reveal (`delay-500`) — a
 *  generic escape hatch rather than any Marcus-specific markup living in
 *  this shared component: that page builds its own decision/steps/wrap-up
 *  cards entirely on its own and just hands the finished `ReactNode` down
 *  through `CustomerInformationPanelBody`/`CustomerInformationSidePanel`'s
 *  own same-named prop. `undefined` for every other caller/interaction —
 *  nothing renders here normally. */
export function CopilotTabContent({ summary, extra }: { summary: CopilotSummary; extra?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4 px-4 py-3">
      {/* Reason for contact — plain info box, same background
          `InlineNotification`'s own "info" variant uses
          (`bg-lyra-status-info-subtle`, inline-notification.tsx) but without
          its icon/dismiss chrome: this is a passive one-line summary, not an
          alert the agent needs to acknowledge or dismiss. First to reveal —
          no `delay-*`. */}
      <div className="animate-in fade-in-0 slide-in-from-bottom-1 fill-mode-backwards duration-500 rounded-lyra-md bg-lyra-status-info-subtle px-4 py-3">
        <p className="lyra-body-md text-lyra-fg-default">{summary.reasonForContact}</p>
      </div>

      {/* Journey Summary — a bordered card with its own soft-purple header
          band (icon + title) over a plain white body, per the reference
          screenshot. `lyra-accent-purple-soft`/`-strong` (tailwind-preset.ts)
          is the same accent pair `Badge`'s `color="purple"` variant resolves
          to (badge.tsx) — used directly here since this is a fixed two-tone
          header bar, not a pill needing that component's full variant
          machinery. Second to reveal — `delay-300` staggers it clearly
          behind the info box above rather than both animating in at once,
          and `fill-mode-backwards` (see this component's own doc comment)
          keeps it invisible for that entire wait instead of flashing fully
          visible first. */}
      <div className="animate-in fade-in-0 slide-in-from-bottom-1 fill-mode-backwards duration-500 delay-300 overflow-hidden rounded-lyra-md border border-lyra-border-subtle">
        <div className="flex items-center gap-2 bg-lyra-accent-purple-soft px-4 py-2.5">
          <Bookmark className="h-4 w-4 shrink-0 text-lyra-accent-purple-strong" strokeWidth={1.5} aria-hidden="true" />
          <span className="lyra-body-md-emphasis text-lyra-fg-default">Journey Summary</span>
        </div>
        <div className="bg-lyra-bg-surface-base px-4 py-3">
          <p className="lyra-body-md text-lyra-fg-default">{summary.journeySummary}</p>
        </div>
      </div>

      {extra && (
        <div className="animate-in fade-in-0 slide-in-from-bottom-1 fill-mode-backwards duration-500 delay-500">
          {extra}
        </div>
      )}
    </div>
  );
}
