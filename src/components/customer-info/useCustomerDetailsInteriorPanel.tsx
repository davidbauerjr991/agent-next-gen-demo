import { useState, useMemo, useEffect } from "react";
import {
  Button,
  TabList,
  Tab,
  PanelFooter,
  type CreateNewOutboundContact,
  type ChannelType,
  type ToastItem,
} from "@nicecxone/lyra-ui";
import { type CreateNewCustomerRecord } from "@nicecxone/lyra-ui/customers-data";
import { ArrowLeft } from "lucide-react";
import { type Thread } from "@/components/agent-next-gen-interaction-dashboard";
import {
  CUSTOMER_PANEL_TABS,
  buildLatestInteraction,
  buildLatestNote,
  buildCopilotSummary,
  resolveCustomerListRecord,
  type CustomerPanelTabLabel,
  type CustomerHistorySessionEntry,
} from "./customer-info-seed";
import { CustomerDetailTabContent, CustomerRecordSaveFooter, type useCustomerRecordDraft } from "./CustomerDetailTabs";
import { CustomerInformationPanelBody } from "./CustomerInformationPanelBody";
import { buildCustomerMatchSubhead, CustomerMatchSearchBody } from "./customer-match";

/* ── useCustomerDetailsInteriorPanel ──
   Per explicit request ("when view all is clicked on the customer
   information — instead of opening the side panel, take the content in the
   customer information side panel and load it in the interior panel with a
   back arrow to the left of the customer name, the content should take
   over the entire interior panel and allow it to expand full screen"): the
   SAME tabbed content `CustomerInformationSidePanel` shows (Overview/
   Detail/Notes/etc. via `CustomerInformationPanelBody`), reused here so it
   can be swapped into the "Details" `InteriorPanel` (see each page file's
   own render site — the same panel that shows `DetailsPanelAccordions`)
   instead of opening the separate docked side panel.

   Deliberately a HOOK, not a component that renders its own `InteriorPanel`
   (unlike `CustomerRowInfoPanel`, which owns a whole panel of its own):
   this content lives inside an `InteriorPanel` the CALLER already renders
   for a different reason (the "Details" panel, shared with
   `DetailsPanelAccordions`), so `headerTabs` needs to reach that panel's
   own `headerTabs` prop (kept OUT of the scrolling body, same as every
   other tabbed panel in this file) while `body` reaches its `children` and
   `footer` its `footer` — three separate slots on one already-existing
   element the caller owns, not something this hook can return as a single
   render tree of its own. Returning them as plain values lets the caller
   just spread them into its existing `InteriorPanel` call's props
   (`headerIcon`/`headerTitle`/`headerSubhead`/`headerTabs`/`footer`/
   `children`, swapped in only while this view is showing).

   `recordDraft`/`overviewEditing`/`onOverviewEditingChange`/`onAddToast`/
   `onStartInteraction`/`onOpenHistoryConversation` are all the SAME lifted
   page-level state/handlers the real `CustomerInformationSidePanel`
   instance already takes (see that component's own doc comments) — passed
   straight through here too so an edit started in one view (this one, the
   docked side panel, or the record-header hover preview) shows up
   consistently in the others, exactly like today. `tabs`/`channels`/
   `recordId`/`customerName` are the same per-caller values already passed
   to that same side panel instance.

   `activeTab` resets to "Overview" only when `recordId` itself changes
   (a genuinely different customer) — not on `onBack`/reopen, matching
   `CustomerInformationSidePanel`'s own behavior (a `SidePanel` that's just
   hidden via `open`, not remounted, so its last-viewed tab persists across
   a close/reopen too). */
export function useCustomerDetailsInteriorPanel({
  customerName,
  recordId,
  channels,
  tabs,
  recordDraft,
  overviewEditing,
  onOverviewEditingChange,
  onAddToast,
  onStartInteraction,
  onOpenHistoryConversation,
  onBack,
  matchState,
  copilotExtra,
  activeTab: activeTabProp,
}: {
  customerName?: string;
  recordId: string;
  channels: Thread[];
  tabs: readonly CustomerPanelTabLabel[];
  recordDraft: ReturnType<typeof useCustomerRecordDraft>;
  overviewEditing: boolean;
  onOverviewEditingChange: (editing: boolean) => void;
  onAddToast?: (toast: Omit<ToastItem, "id">) => void;
  onStartInteraction: (contact: CreateNewOutboundContact, channel: ChannelType, phone: string, skillId: string) => void;
  onOpenHistoryConversation?: (entry: CustomerHistorySessionEntry) => void;
  /** Fired by the returned `headerIcon` (the back arrow) — the caller is
   *  expected to swap this view back off (e.g. `setCustomerDetailsOpen(false)`). */
  onBack: () => void;
  /** Per explicit follow-up request ("customer information, details and
   *  customer summary are all opening in separate panels, they should all
   *  open in one side panel..."): the SAME unknown-contact customer-
   *  matching UI `CustomerInformationSidePanel` already supports (see that
   *  component's own `matchState` prop doc comment) — this whole view
   *  branches on it being present the identical way that component does,
   *  so `AgentWorkspace2WithDeskPage.tsx` loses nothing by routing its
   *  standalone docked panel's content through this hook instead.
   *  `undefined` for every other consumer/interaction. */
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
  /** Passed straight through to `CustomerInformationPanelBody`'s own same-
   *  named prop — see that prop's own doc comment. `undefined` for every
   *  interaction except the Marcus Webb scripted scenario
   *  (AgentWorkspace2WithDeskPage.tsx). */
  copilotExtra?: React.ReactNode;
  /** Controls which tab's body shows (Contact Details' Customer Information,
   *  Notes and Detail tabs, P-CANVAS); omitted, the drill-in's own tab row does. */
  activeTab?: CustomerPanelTabLabel;
}) {
  const [ownActiveTab, setActiveTab] = useState(() => CUSTOMER_PANEL_TABS.indexOf("Overview"));
  useEffect(() => {
    setActiveTab(CUSTOMER_PANEL_TABS.indexOf("Overview"));
  }, [recordId]);
  const activeTab = activeTabProp !== undefined ? CUSTOMER_PANEL_TABS.indexOf(activeTabProp) : ownActiveTab;
  // Copilot always stripped, same as every other consumer of this body —
  // see `CustomerInformationSidePanel`'s own `visibleTabs` doc comment.
  const visibleTabs = tabs.filter((t) => t !== "Copilot");
  const latestInteraction = useMemo(() => buildLatestInteraction(customerName, recordId), [customerName, recordId]);
  const latestNote = useMemo(() => buildLatestNote(customerName, recordId), [customerName, recordId]);
  const copilotSummary = useMemo(() => buildCopilotSummary(customerName, recordId), [customerName, recordId]);
  const row = useMemo(() => resolveCustomerListRecord(recordId), [recordId]);
  // See `buildCustomerMatchSubhead`'s own doc comment — shared with
  // `CustomerInformationSidePanel`/`CustomerInfoHoverPreview` so every
  // surface that can show the unknown-contact match flow for the same
  // interaction never disagrees on the count/wording or which list shows.
  const { subhead: matchSubhead, visibleList: matchVisibleList } = matchState
    ? buildCustomerMatchSubhead(matchState.query, matchState.possibleMatches, matchState.searchResults)
    : { subhead: "", visibleList: [] };

  return {
    headerIcon: (
      <button
        type="button"
        onClick={matchState?.step === "create" ? matchState.onBackToSearch : onBack}
        aria-label={matchState?.step === "create" ? "Back to search" : "Back to Details"}
        className="flex h-6 w-6 items-center justify-center rounded-lyra-sm text-lyra-fg-secondary hover:bg-lyra-state-hover transition-colors"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
      </button>
    ),
    // While `matchState` is set (see that prop's own doc comment), the
    // title/subhead/tabs below all branch on it exactly the way
    // `CustomerInformationSidePanel` already does for its own identical
    // header — see that component's own doc comments for the full "why"
    // behind each branch.
    headerTitle: matchState
      ? matchState.step === "create"
        ? "Create New Customer"
        : "Customer Information"
      : customerName || "Customer",
    headerSubhead: matchState
      ? matchState.step === "search"
        ? matchSubhead
        : undefined
      : recordId,
    headerTabs: matchState ? undefined : (
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
    ),
    footer: matchState ? (
      matchState.step === "search" ? (
        <PanelFooter>
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
    ) : recordDraft.isDirty || overviewEditing ? (
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
    ) : undefined,
    body: matchState ? (
      matchState.step === "search" ? (
        <CustomerMatchSearchBody
          query={matchState.query}
          onQueryChange={matchState.onQueryChange}
          matches={matchVisibleList}
          onLinkRecord={matchState.onLinkRecord}
        />
      ) : (
        <CustomerDetailTabContent
          fields={recordDraft.draft.overviewFields}
          draft={recordDraft.draft}
          onDraftChange={recordDraft.updateDraft}
        />
      )
    ) : (
      <CustomerInformationPanelBody
        activeTab={activeTab}
        customerName={customerName}
        latestInteraction={latestInteraction}
        latestNote={latestNote}
        copilotSummary={copilotSummary}
        copilotExtra={copilotExtra}
        recordId={recordId}
        channels={channels}
        onOpenConversation={onOpenHistoryConversation}
        onViewAllInteractions={
          visibleTabs.includes("Contacts")
            ? () => setActiveTab(CUSTOMER_PANEL_TABS.indexOf("Contacts"))
            : undefined
        }
        draft={recordDraft.draft}
        onDraftChange={recordDraft.updateDraft}
        onPhoneChange={recordDraft.updatePhone}
        onOverviewFieldChange={recordDraft.updateOverviewField}
        overviewEditing={overviewEditing}
        onOverviewEditingChange={onOverviewEditingChange}
        allowOverviewEdit
        row={row}
        onStartInteraction={onStartInteraction}
      />
    ),
  };
}
