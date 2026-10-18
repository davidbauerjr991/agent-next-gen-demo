import { useState, useMemo } from "react";
import {
  Button,
  TabList,
  Tab,
  ActionIconButton,
  PanelHeader,
  PanelFooter,
  AIInput,
  type CreateNewOutboundContact,
  type ChannelType,
  type ToastItem,
} from "@nicecxone/lyra-ui";
import { type CreateNewCustomerRecord } from "@nicecxone/lyra-ui/customers-data";
import { ArrowLeft } from "lucide-react";
import { type Thread } from "@/components/agent-next-gen-interaction-dashboard";
import {
  CUSTOMER_PANEL_TABS,
  SHOW_CUSTOMER_INFO_AI_INPUT,
  buildLatestInteraction,
  buildLatestNote,
  buildCopilotSummary,
  resolveCustomerListRecord,
  type CustomerPanelTabLabel,
} from "./customer-info-seed";
import { CustomerDetailTabContent, CustomerRecordSaveFooter, type useCustomerRecordDraft } from "./CustomerDetailTabs";
import { CustomerInformationPanelBody } from "./CustomerInformationPanelBody";
import { buildCustomerMatchSubhead, CustomerMatchSearchBody } from "./customer-match";

/** Shows the exact same "Customer Information" content the real panel
 *  displays — same `CustomerInformationPanelBody`, fed by the same
 *  `buildCustomerInfoFields`/`buildLatestInteraction`/`buildLatestNote`
 *  data and the same `CUSTOMER_PANEL_TABS` tab set, even the same
 *  Overview-tab `AIInput` footer — inside a `Popover` when the agent
 *  hovers the record header's toggle icon while the real panel is closed
 *  (see the render site further down). A hover-preview flyout of the panel
 *  itself, per explicit request, not a separate hand-built summary — this
 *  can never show something different from what actually opening the panel
 *  would. Same idea as `InteractionNavItem`'s own compact-rail hover
 *  preview (interaction-nav-item.tsx: "think of how you display your left
 *  nav when it's closed"), which shows that card's full real content
 *  (`cardBody`) inside a bare, self-chromed `Popover` rather than a
 *  simplified stand-in — this component supplies that same complete chrome
 *  itself (border/background/shadow/rounded corners, matching `SidePanel`'s
 *  own `bg-lyra-bg-surface-container-subtle` — side-panel.tsx) since the
 *  render site strips the default `Popover` framing to a bare frame around
 *  it, exactly like that same precedent.
 *
 *  Sized to actually fit as a flyout (fixed `w-[340px]`, matching this
 *  panel's own default docked width, `max-h-[70vh]` with only the body
 *  scrolling) rather than the real panel's full docked/full-screen height —
 *  the header (title/subhead + tabs) stays pinned via `PanelHeader`'s own
 *  `tabs` prop, same fixed-header/scrolling-body split `SidePanel` itself
 *  uses, so a tall tab's content scrolls internally instead of pushing the
 *  popover off-screen. Owns its own `activeTab` state (starts on Overview),
 *  independent of the real panel's own — switching tabs in this preview
 *  doesn't affect, and isn't affected by, whatever tab the agent last left
 *  the real panel on.
 *
 *  `onMouseEnter`/`onMouseLeave` are wired by the caller to the exact same
 *  open-immediately/close-on-a-short-delay handlers as the trigger icon
 *  itself — Radix `Popover.Content` portals straight to `document.body`,
 *  outside the trigger icon's own DOM subtree, so without re-arming here
 *  too, moving the pointer from the icon into this (portaled) popover would
 *  fire the icon's own `onMouseLeave` and close the preview before the
 *  agent can actually read it — same fix already applied once for
 *  `InteractionNavItem`'s own hover-preview card. */
export function CustomerInfoHoverPreview({
  customerName,
  recordId,
  channels,
  startedFresh,
  tabs,
  onMouseEnter,
  onMouseLeave,
  onAddToast,
  recordDraft,
  overviewEditing,
  onOverviewEditingChange,
  matchState,
  copilotExtra,
  onStartInteraction,
  bodyOverride,
}: {
  customerName?: string;
  recordId: string;
  channels: Thread[];
  /** Same "has this conversation actually started yet" signal
   *  `CustomerInformationSidePanel` uses for its own `copilotAvailable` —
   *  see that prop's own doc comment. Mirrors the exact real panel this
   *  preview shows, so a hover preview never shows Copilot as available
   *  when opening the real panel wouldn't. */
  startedFresh?: boolean;
  /** Which tabs this preview supports at all, in order — see
   *  `CustomerInformationSidePanel`'s own `tabs` doc comment. The caller
   *  passes the SAME list it configures its own real
   *  `CustomerInformationSidePanel` with, for the same "never show
   *  something the real panel wouldn't" reason this component's own
   *  top-of-file doc comment already covers for content. */
  tabs: readonly CustomerPanelTabLabel[];
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  /** Fires a toast into the shared stack the caller owns — same prop/
   *  reasoning as `CustomerInformationSidePanel`'s own `onAddToast` (see
   *  that prop's doc comment); fired on a successful Customer Overview
   *  save below. */
  onAddToast?: (toast: Omit<ToastItem, "id">) => void;
  /** The SAME `useCustomerRecordDraft` instance the caller also passes to
   *  its real `CustomerInformationSidePanel` for this exact interaction —
   *  LIFTED here (this component used to own a totally separate instance)
   *  per explicit request: this popover's own content unmounts every time
   *  the agent hovers off (Radix `Popover.Content` has no `forceMount`),
   *  which used to silently wipe any pending edit the instant the mouse
   *  left. Sharing one instance with the docked panel means hovering off
   *  and back on (or opening/closing the docked panel instead) never loses
   *  anything — the draft only resets when `recordId` changes (inside
   *  `useCustomerRecordDraft` itself) or the interaction is actually
   *  dismissed (the caller's instance goes away with it), never merely
   *  from this popover unmounting. */
  recordDraft: ReturnType<typeof useCustomerRecordDraft>;
  /** Same lift as `recordDraft` above, for the identical reason — see that
   *  prop's own doc comment. */
  overviewEditing: boolean;
  onOverviewEditingChange: (editing: boolean) => void;
  /** Per explicit request: this hover preview must show the SAME
   *  information the docked open panel does, for the exact same
   *  interaction — so it needs the exact same `matchState` prop
   *  `CustomerInformationSidePanel` accepts (see that prop's own doc
   *  comment for what each piece does), not just the same `tabs`/
   *  `recordDraft`. `undefined` for a real-customer interaction, same as
   *  the docked panel. */
  matchState?: {
    step: "search" | "create";
    query: string;
    onQueryChange: (query: string) => void;
    possibleMatches: CreateNewCustomerRecord[];
    searchResults: CreateNewCustomerRecord[];
    onLinkRecord: (customer: CreateNewCustomerRecord) => void;
    onStartCreate: () => void;
    onBackToSearch: () => void;
    onSaveNewCustomer: () => void;
  };
  /** Per explicit request ("make sure to update the hover state of copilot
   *  to match the docked state"): passed straight through to
   *  `CustomerInformationPanelBody`'s own same-named prop (see that prop's
   *  own doc comment) exactly like `CustomerInformationSidePanel` already
   *  does — this hover preview never had this prop at all before, so its
   *  own Copilot tab was silently missing whatever the docked panel's own
   *  `copilotExtra` was showing (the Marcus Webb scenario's summary cards/
   *  decision flow) even though every OTHER piece of Copilot content
   *  (`copilotSummary`) was already shared between the two. `undefined` for
   *  every interaction that has no scripted extra content, same default
   *  every other consumer gets. */
  copilotExtra?: React.ReactNode;
  /** Per explicit request ("put the customer available channels in the
   *  Customer Overview in the same row as the edit... for all Customer
   *  Information panels... make sure this is reflected in the hover panel
   *  as well") — feeds `CustomerInformationPanelBody`'s own `row`/
   *  `onStartInteraction` props exactly like `CustomerInformationSidePanel`
   *  does (see that prop's own doc comment); `row` itself is derived from
   *  `recordId` right below via `resolveCustomerListRecord`, same as the
   *  docked panel. */
  onStartInteraction: (contact: CreateNewOutboundContact, channel: ChannelType, phone: string, skillId: string) => void;
  /** Same override as `CustomerInformationSidePanel`'s own identically-
   *  named prop — see that component's own doc comment for the full "why".
   *  Advanced passes the SAME `DetailsPanelAccordions` element to both this
   *  hover preview and the docked panel, so the two never disagree on what
   *  they show for the same interaction, exactly like every other piece of
   *  content this preview mirrors from the docked panel. */
  bodyOverride?: React.ReactNode;
}) {
  const latestInteraction = useMemo(
    () => buildLatestInteraction(customerName, recordId),
    [customerName, recordId]
  );
  const latestNote = useMemo(() => buildLatestNote(customerName, recordId), [customerName, recordId]);
  // See `resolveCustomerListRecord`'s own doc comment above — same lookup
  // `CustomerInformationSidePanel` performs, so the hover preview's own
  // Customer Overview row shows the identical channel icons the docked
  // panel does for this same interaction.
  const row = useMemo(() => resolveCustomerListRecord(recordId), [recordId]);
  const copilotSummary = useMemo(() => buildCopilotSummary(customerName, recordId), [customerName, recordId]);
  // Per explicit request ("stop launching copilot - hide it completely")
  // — Copilot is now unconditionally excluded below (`visibleTabs`), same
  // as `CustomerInformationSidePanel`'s identical fix just below in this
  // file (see that component's own doc comment for the full reasoning).
  // `copilotSummary`/`buildCopilotSummary` above stay computed regardless
  // — `ContactOverview`'s own `journeySummary` prop now reuses that exact
  // recap in its new home.
  const [activeTab, setActiveTab] = useState(() => CUSTOMER_PANEL_TABS.indexOf("Overview"));
  const visibleTabs = tabs.filter((t) => t !== "Copilot");
  // See `buildCustomerMatchSubhead`'s own doc comment — shared with
  // `CustomerInformationSidePanel` so the docked panel and this hover
  // preview never disagree on the match count/wording or which list is
  // showing, for the exact same interaction.
  const { subhead: matchSubhead, visibleList: matchVisibleList } = matchState
    ? buildCustomerMatchSubhead(matchState.query, matchState.possibleMatches, matchState.searchResults)
    : { subhead: "", visibleList: [] };

  return (
    <div
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      // `h-[80vh] max-h-[768px]` — a standard size regardless of which
      // tab's content happens to be active, rather than shrinking to fit
      // whatever's shortest (confirmed live: switching to the Interactions
      // tab here — before it had `recordId`/`channels` wired below — showed
      // nothing, and with no min/fixed height the whole flyout collapsed
      // down to just its header, which read as broken rather than merely
      // empty). `80vh` scales with the viewport (was `90vh` — confirmed
      // live that overflowed the screen on a normal-height display, since
      // this popover trigger sits fairly high up the record header, not
      // vertically centered — 80vh leaves enough margin above/below to
      // stay fully on-screen), and `max-h-[768px]` caps it from growing
      // arbitrarily tall on very large displays — per explicit spec.
      className="flex h-[80vh] max-h-[768px] w-[340px] flex-col overflow-hidden rounded-lyra-lg border border-lyra-border-soft bg-lyra-bg-surface-container-subtle shadow-lg"
    >
      <PanelHeader
        // Static "Customer Information" now (was the customer's own
        // name + record id) — per explicit request, this hover preview's
        // header no longer doubles as an identity readout; the name/id
        // are still available via the Overview tab's own fields below.
        //
        // While `matchState` is set (see that prop's own doc comment),
        // this reads "Create New Customer" (create step, with a back-arrow
        // `icon` ahead of it) or keeps "Customer Information" (search
        // step) with the possible-matches/search-results count as
        // `subhead` — same header treatment
        // `CustomerInformationSidePanel` uses for the docked panel, per
        // explicit request that the two never show different information
        // for the same interaction.
        title={matchState?.step === "create" ? "Create New Customer" : "Customer Information"}
        // Per a later explicit follow-up request ("add the customer name
        // subhead to the customer information panel when it is not
        // docked") — this hover preview IS that "not docked" panel
        // (`CustomerInformationSidePanel` is the docked one, which already
        // got this same `customerName` subhead per an earlier follow-up —
        // see that panel's own `headerSubhead` doc comment). Brings this
        // preview to parity with the docked panel rather than leaving it
        // as the one remaining place the name doesn't show in the header.
        // Same three-way branch as the docked panel's `headerSubhead`:
        // the match-search step keeps its own count subhead, the
        // match-create step has none (no confirmed customer yet), and the
        // ordinary case now shows `customerName`.
        subhead={
          matchState?.step === "search"
            ? matchSubhead
            : matchState?.step === "create"
              ? undefined
              : customerName
        }
        icon={
          matchState?.step === "create" ? (
            <ActionIconButton aria-label="Back to search" title="Back" onClick={matchState.onBackToSearch}>
              <ArrowLeft className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
            </ActionIconButton>
          ) : undefined
        }
        // `undefined` entirely while `matchState` is set — neither match
        // step has a tab list, same as the docked panel.
        tabs={
          matchState || bodyOverride ? undefined : (
          <TabList className="px-4" overflowMenu>
            {visibleTabs.map((label) => (
              <Tab
                key={label}
                active={activeTab === CUSTOMER_PANEL_TABS.indexOf(label)}
                onClick={() => setActiveTab(CUSTOMER_PANEL_TABS.indexOf(label))}
              >
                {label}
              </Tab>
            ))}
          </TabList>
          )
        }
      />
      <div className="flex-1 overflow-y-auto">
        {matchState ? (
          matchState.step === "search" ? (
            <CustomerMatchSearchBody
              query={matchState.query}
              onQueryChange={matchState.onQueryChange}
              matches={matchVisibleList}
              onLinkRecord={matchState.onLinkRecord}
            />
          ) : (
            // Same "reuse the Detail tab's own draft/form" approach as
            // `CustomerInformationSidePanel`'s identical branch — see that
            // render call site's own doc comment.
            <CustomerDetailTabContent
              fields={recordDraft.draft.overviewFields}
              draft={recordDraft.draft}
              onDraftChange={recordDraft.updateDraft}
            />
          )
        ) : bodyOverride ? (
          bodyOverride
        ) : (
          <CustomerInformationPanelBody
            activeTab={activeTab}
            customerName={customerName}
            latestInteraction={latestInteraction}
            latestNote={latestNote}
            copilotSummary={copilotSummary}
            copilotExtra={copilotExtra}
            // Was left unwired (Contacts rendered nothing here, same
            // stub treatment as Tasks/Notes/Accounts/Tickets) — but unlike
            // those genuinely-unimplemented tabs, this data is already
            // sitting right here in scope (this component's own required
            // `recordId`/`channels` props), so there's no real reason not to
            // show it. Per explicit follow-up request.
            recordId={recordId}
            channels={channels}
            // `undefined` (no button at all) when "Contacts" isn't one of
            // this preview's configured `tabs` — see `visibleTabs`'s own doc
            // comment on `CustomerInformationSidePanel` for why: without this
            // gate, Overview's "View All Contacts" button would jump
            // `activeTab` to a tab that isn't in the header at all.
            onViewAllInteractions={
              tabs.includes("Contacts")
                ? () => setActiveTab(CUSTOMER_PANEL_TABS.indexOf("Contacts"))
                : undefined
            }
            draft={recordDraft.draft}
            onDraftChange={recordDraft.updateDraft}
            onPhoneChange={recordDraft.updatePhone}
            onOverviewFieldChange={recordDraft.updateOverviewField}
            allowOverviewEdit
            overviewEditing={overviewEditing}
            onOverviewEditingChange={onOverviewEditingChange}
            // Per explicit request ("...make sure this is reflected in the
            // hover panel as well") — same `row`/`onStartInteraction` wiring
            // as `CustomerInformationSidePanel`'s own identical call site;
            // see this component's own `row` const above for how it's
            // derived.
            row={row}
            onStartInteraction={onStartInteraction}
          />
        )}
      </div>
      {/* Footer — while `matchState` is set, this is EITHER the search
          step's full-width "Create New Customer" button or the create
          step's Cancel/Save pair, checked ahead of everything else below —
          same priority/reasoning as `CustomerInformationSidePanel`'s own
          `footer` prop (see that render call site's own comment). */}
      {matchState ? (
        matchState.step === "search" ? (
          <PanelFooter className="shrink-0">
            <Button className="w-full" onClick={matchState.onStartCreate}>
              Create New Customer
            </Button>
          </PanelFooter>
        ) : (
          <CustomerRecordSaveFooter
            onSave={matchState.onSaveNewCustomer}
            onCancel={() => {
              recordDraft.cancel();
              matchState.onBackToSearch();
            }}
          />
        )
      ) : (
      /* Save/Cancel footer — checked FIRST, same priority/reasoning as
          `CustomerInformationSidePanel`'s own `footer` prop (see that call
          site's own comment): per explicit request this hover preview now
          has the exact same Customer Overview edit/save capability the two
          real panels do, so it needs the same footer, outranking the
          Copilot/AIInput branches below exactly like the real panels'
          Detail/Directory footer does. */
      recordDraft.isDirty || overviewEditing ? (
        <CustomerRecordSaveFooter
          onSave={() => {
            recordDraft.save();
            onOverviewEditingChange(false);
            onAddToast?.({
              variant: "success",
              title: "Success",
              message: customerName ? `${customerName} customer record saved` : "Customer record saved",
              duration: 4000,
            });
          }}
          onCancel={() => {
            recordDraft.cancel();
            onOverviewEditingChange(false);
          }}
        />
      ) : /* Same Overview-only `AIInput` footer as the real panel (see its own
          `footer` prop above) — kept here too for exact content parity,
          per this component's own doc comment. `SHOW_CUSTOMER_INFO_AI_INPUT`
          — see that flag's own doc comment — temporarily hides both this
          AND Copilot's own singleLine `AIInput` just below, per a later
          explicit follow-up request. `singleLine` (per an earlier explicit
          follow-up request) renders it as a single compact row — attach/
          input/submit all inline — instead of `AIInput`'s own default
          stacked textarea-above/toolbar-below layout; `helperText=""`
          suppresses that layout's own default caption text, since a
          single-row search-bar affordance reads better without one
          directly underneath it. */
      SHOW_CUSTOMER_INFO_AI_INPUT && activeTab === CUSTOMER_PANEL_TABS.indexOf("Copilot") ? (
        <PanelFooter className="shrink-0 justify-start">
          <AIInput singleLine helperText="" className="w-full" />
        </PanelFooter>
      ) : (
        SHOW_CUSTOMER_INFO_AI_INPUT &&
        activeTab === CUSTOMER_PANEL_TABS.indexOf("Overview") && (
          <PanelFooter className="relative shrink-0 justify-start">
            <div
              className="pointer-events-none absolute inset-x-0 -top-8 h-8 bg-gradient-to-b from-transparent to-lyra-bg-surface-container-subtle"
              aria-hidden="true"
            />
            <AIInput placeholder="Ask about this customer..." showAttach={false} className="w-full" />
          </PanelFooter>
        )
      )
      )}
    </div>
  );
}
