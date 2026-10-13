// Search panel content (the "Search" `EmbeddablePanelContent` shown in the
// right-docked panel rail) — shared between `AgentNextGenPage.tsx` (Agent
// Workspace 2.0) and `AgentWorkspace2WithDeskPage.tsx` (Agent Workspace 2.0
// With Desk), per explicit request. Previously this lived inline in
// `AgentNextGenPage.tsx` only, with the two pages' Search panels having
// drifted into two different shapes (this one's real Contacts/
// Messages/Customers/Threads sub-tabs vs. With Desk's older standalone-
// `SearchInput` version) — extracted here so both pages render the exact
// same underlying tab/content system, just configured with a different
// `tabs` list each.
//
// `useSearchPanelContent` mirrors the same "self-contained hook returning
// a ready `EmbeddablePanelContent`" shape `useScheduleContent`
// (SchedulePanel.tsx) already uses for its own panel — own the
// tab-switching state internally, take whatever data/handlers the
// INCLUDED tabs need as params. "Customers" needs a fairly large bag of
// lifted state (`SearchPanelCustomersProps` below) since — per the
// original inline version's own doc comment — it reuses the EXACT SAME
// state the Desk dashboard's own "Customers" tab uses, not a second,
// independent copy; that lifting has to stay in the page itself (the
// common ancestor of both places Customers is reachable from), so this
// hook just accepts it as a prop bag rather than owning it.
import { useState } from "react";
import { ChevronRight, Inbox } from "lucide-react";
import {
  TabList,
  Tab,
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
  SearchInput,
  ListItem,
  type EmbeddablePanelContent,
  type ChannelType,
  type CreateNewOutboundContact,
  type SortDirection,
  type ToastItem,
} from "@nicecxone/lyra-ui";
import {
  InteractionsListView,
  type InteractionHistoryRecord,
} from "@/components/agent-next-gen-interactions-table";
import {
  CustomersListView,
  CustomerChannelCell,
  type CustomerListRecord,
  type CustomerColKey,
} from "@/components/agent-next-gen-customers-table";
import {
  CustomerFullScreenTabContent,
  type CustomerPanelTabLabel,
} from "@/components/agent-next-gen-customer-info-panel";

export type SearchPanelTabKey = "interactions" | "messages" | "customers" | "threads";

// Per explicit follow-up request, the "interactions" sub-tab's own display
// label reads "Contacts" now — the underlying `SearchPanelTabKey` value
// (`"interactions"`), the `InteractionsListView` component it renders, and
// every internal reference to "interactions"/"Interactions" data in this
// file's own doc comments stay as-is; only this user-visible tab label
// changed.
export const SEARCH_PANEL_TAB_LABELS: Record<SearchPanelTabKey, string> = {
  interactions: "Contacts",
  messages: "Messages",
  customers: "Customers",
  threads: "Threads",
};

/** Everything the "Customers" sub-tab needs — all lifted state/handlers,
 *  same shape `<CustomersListView>`/`<CustomerRowInfoPanel>` already take
 *  directly (see agent-next-gen-customers-table.tsx /
 *  agent-next-gen-customer-info-panel.tsx), just gathered into one bag so
 *  `useSearchPanelContent` below has a single optional param to accept
 *  instead of a dozen loose ones. Omit this prop entirely (and leave
 *  `"customers"` out of `tabs`) for a consumer with no Customers concept
 *  at all — see `AgentWorkspace2WithDeskPage.tsx`'s own usage. */
export interface SearchPanelCustomersProps {
  onStartInteraction: (
    contact: CreateNewOutboundContact,
    channel: ChannelType,
    phone: string,
    skillId: string
  ) => void;
  addedFilterKeys: string[];
  onAddedFilterKeysChange: (keys: string[]) => void;
  filterValues: Record<string, string[]>;
  onFilterValuesChange: (values: Record<string, string[]>) => void;
  onRowClick: (row: CustomerListRecord) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  /** Per explicit follow-up request ("keep the latest search results after
   *  a search is run if navigated away from the search panel") — whether
   *  `SimpleCustomerSearchBody`'s results list is showing, lifted up here
   *  the same way `searchQuery` above already is. This used to be a plain
   *  `useState` owned locally inside `SimpleCustomerSearchBody` itself (see
   *  that component's own git history) — which worked fine while the panel
   *  stayed mounted, but reset back to `false` the instant the Search panel
   *  was closed and reopened (switching to another app-header icon, e.g.
   *  Notifications, then back), even though `searchQuery` itself — already
   *  page-level state — survived that same round-trip untouched. Now lives
   *  alongside `searchQuery`/`onSearchChange` in whichever page owns this
   *  bag (`customerSearchSubmitted`/`setCustomerSearchSubmitted`, next to
   *  `customerSearchQuery` itself), so both survive the panel unmounting
   *  identically. */
  searchSubmitted: boolean;
  onSearchSubmittedChange: (submitted: boolean) => void;
  sortKey: CustomerColKey | null;
  sortDir: SortDirection;
  onSort: (key: CustomerColKey) => void;
  sortedRows: CustomerListRecord[];
  selectedRow: CustomerListRecord | null;
  onCloseRow: () => void;
  onPreviousRow: () => void;
  onNextRow: () => void;
  hasPreviousRow: boolean;
  hasNextRow: boolean;
  /** Forwarded straight through to `CustomersListView`'s own `isRowOpen` —
   *  see that prop's own doc comment (agent-next-gen-customers-table.tsx)
   *  for what it does. Optional/omittable like the underlying prop itself;
   *  currently only `AgentWorkspaceAdvancedPage.tsx` passes it. */
  isRowOpen?: (row: CustomerListRecord) => boolean;
  /** Which `CustomerFullScreenTabContent` tabs to show once a row is
   *  selected — previously hard-coded to `AGENT_WORKSPACE_CUSTOMER_PANEL_
   *  TABS` here (see that constant's own doc comment for why: only
   *  Advanced's Search-panel "Customers" tab rendered this branch at the
   *  time). Now threaded through explicitly instead, since `simpleCustomer
   *  Search` (below) renders this same branch from BOTH Premium and
   *  Advanced, and each tier's own main desk-tab Customers view already
   *  uses a different tab set (Premium: the full `CUSTOMER_PANEL_TABS`;
   *  Advanced: the reduced `AGENT_WORKSPACE_CUSTOMER_PANEL_TABS`) — each
   *  call site passes whichever one matches its own tier's convention. */
  panelTabs: readonly CustomerPanelTabLabel[];
}

export interface UseSearchPanelContentOptions {
  /** Which sub-tabs to show, in display order — the FIRST entry here is
   *  both the leftmost tab AND this hook's own default active tab (see
   *  `activeTab`'s own `useState` initializer below), so reordering this
   *  array is also how a consumer picks which tab is showing by default. */
  tabs: SearchPanelTabKey[];
  /** Required when `"interactions"` is included in `tabs` — forwarded
   *  straight through to `InteractionsListView`'s own `onAddToast`. */
  onAddToast?: (toast: Omit<ToastItem, "id">) => void;
  /** Used when `"interactions"` is included in `tabs` — forwarded straight
   *  through to `InteractionsListView`'s own `onOpenInteraction`. Per
   *  explicit request, clicking a row here opens it as a real, active
   *  assignment in the left nav; each consumer wires this to its own copy
   *  of the same "build an `Interaction` from this row and switch to
   *  it" handler `AgentNextGenPage.tsx`/`AgentWorkspace2WithDeskPage.tsx`
   *  already use for `handleOpenAssignmentFromNotification`. */
  onOpenInteraction?: (record: InteractionHistoryRecord) => void;
  /** Required when `"customers"` is included in `tabs`. */
  customers?: SearchPanelCustomersProps;
  /** Per explicit request ("in advanced and premium, clear the search
   *  panel of content and just have a search bar - when the agent types
   *  into it - add a 'search' icon button into the input then when
   *  clicked display results - when the agent clicks on the customer
   *  display their customer information content") — when `true`, this
   *  hook ignores `tabs`/`onOpenInteraction` entirely (no Contacts/
   *  Messages/Customers/Threads `TabList`) and instead renders ONLY the
   *  `SimpleCustomerSearchBody` below: a bare search bar, gated results
   *  list on submit, and `CustomerFullScreenTabContent` once a row is
   *  picked (reusing the exact same "selected row takes over the whole
   *  panel body" mechanism the old `"customers"` tab branch already used
   *  — see that branch's own doc comment for why). Requires `customers`
   *  to be set. Both Premium (`AgentWorkspace2WithDeskPage.tsx`) and
   *  Advanced (`AgentWorkspaceAdvancedPage.tsx`) opt into this; Agent
   *  Workspace 2.0's own call site is unaffected (and, since its Search
   *  app header icon is separately hidden entirely — see BEHAVIOR.md
   *  §139 — this panel is unreachable there regardless of what it
   *  renders). */
  simpleCustomerSearch?: boolean;
}

/** Per explicit request (see `simpleCustomerSearch`'s own doc comment
 *  above) — a deliberately minimal search flow: a `SearchInput` with the
 *  new opt-in `onSubmit` button (lyra-ui, search-input.tsx), gated results
 *  (nothing shown until the agent actually submits a non-empty query, NOT
 *  live-as-you-type — the request was explicit that results only appear
 *  "when clicked"), and a plain `ListItem` row per match (name/ID/chevron)
 *  rather than the full `CustomersListView` data-table (sorting, filters,
 *  bulk-select, column headers) the old "Customers" tab used — the
 *  reference screenshot showed a simple flat list, not a table.
 *
 *  Deliberately gates "should the list show" via `customers.searchSubmitted`
 *  rather than deriving it purely from `customers.searchQuery` being
 *  non-empty: `customers.searchQuery`/`sortedRows` are the SAME shared
 *  state the tier's own main Customers desk tab uses (per this file's own
 *  top-of-file doc comment), so `sortedRows` is already live-filtered on
 *  every keystroke regardless — this flag is what gates whether that
 *  already-computed list is actually SHOWN here, independent of the
 *  underlying state's own reactivity. Reset back to the bare-bar state
 *  whenever the query is cleared to empty (typing it back out, or the
 *  input's own clear button), so re-focusing an empty box never shows a
 *  stale result list from a previous search. Per explicit follow-up
 *  request ("keep the latest search results after a search is run if
 *  navigated away from the search panel") — `searchSubmitted` is now
 *  LIFTED state (see that field's own doc comment on `SearchPanelCustomers
 *  Props` above), not a local `useState` here, so it survives the Search
 *  panel itself being unmounted/remounted by navigating to another
 *  app-header icon and back. */
function SimpleCustomerSearchBody({ customers }: { customers: SearchPanelCustomersProps }) {
  const query = customers.searchQuery;

  const handleQueryChange = (value: string) => {
    customers.onSearchChange(value);
    if (value.trim() === "") customers.onSearchSubmittedChange(false);
  };

  const handleSubmit = (value: string) => {
    if (value.trim() !== "") customers.onSearchSubmittedChange(true);
  };

  const showResults = customers.searchSubmitted && query.trim() !== "";

  return (
    <div className="flex flex-1 flex-col min-h-0">
      <div className="p-4">
        <SearchInput
          value={query}
          onValueChange={handleQueryChange}
          onSubmit={handleSubmit}
          placeholder="Search Customers"
        />
      </div>
      {showResults && (
        customers.sortedRows.length > 0 ? (
          <div className="flex-1 overflow-y-auto flex flex-col">
            {customers.sortedRows.map((row) => (
              <ListItem
                key={row.contactNumber}
                // `group` — needed so `CustomerChannelCell`'s own per-icon
                // `group-hover`/`group-focus-within` fade (agent-next-gen-
                // customers-table.tsx) has a hover/focus context to key off,
                // exactly the same convention that component's own doc
                // comment describes for its `CustomersListView` `TableRow`
                // usage. No `relative` needed here (unlike the table's
                // separate `leadingChannelStack` overlay variant,
                // `CustomerChannelStack`) — these icons render as normal
                // trailing flex content, not an absolutely-positioned
                // overlay painted over other text.
                className="group"
                title={`${row.firstName} ${row.lastName}`}
                subtitle={row.contactNumber}
                trailing={
                  // Per explicit request ("display the channel icon buttons
                  // on hover of customers in the search and allow the agent
                  // to launch an interaction from those buttons the same way
                  // they normally would") — reuses `CustomerChannelCell`
                  // as-is: the exact same hover-reveal channel-icon row (and
                  // `CustomerChannelPopoverButton`/`onStartInteraction` launch
                  // flow) the Customers table's own "Channels" column
                  // already renders, rather than a new one-off treatment.
                  // Each icon's own `onClick` already `stopPropagation`s
                  // (see that component's own doc comment), so clicking a
                  // channel icon launches straight into that channel's
                  // picker without also firing this row's `onClick` below.
                  <div className="flex items-center gap-1">
                    <CustomerChannelCell row={row} onStartInteraction={customers.onStartInteraction} />
                    <ChevronRight className="h-4 w-4 text-lyra-fg-secondary" strokeWidth={1.5} aria-hidden="true" />
                  </div>
                }
                onClick={() => customers.onRowClick(row)}
              />
            ))}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto flex flex-col items-center justify-center gap-2 p-4 text-center">
            <Inbox className="h-6 w-6 text-lyra-fg-secondary" strokeWidth={1.5} aria-hidden="true" />
            <span className="lyra-body-md text-lyra-fg-secondary">No matching customers</span>
          </div>
        )
      )}
    </div>
  );
}

/** Generic `title` builder for this panel's `Breadcrumb` — per follow-up
 *  ("update the breadcrumb to be more generic") this replaces what used to
 *  be two separate, hand-duplicated cases (a flat `"Search"` string for the
 *  ordinary tab view, and a one-off 2-crumb `Breadcrumb` JSX block only for
 *  the selected-customer-row view) with a single reusable renderer that
 *  works for any depth. Takes an ordered list of crumbs from root to
 *  current; all but the last render as an interactive `BreadcrumbLink`
 *  (wired to `onClick` when supplied — omit it for a crumb with nowhere to
 *  navigate back to, e.g. the root "Search" crumb in the plain tab-view
 *  case), and the last always renders as the non-interactive current-page
 *  `BreadcrumbPage` — real lyra-ui `Breadcrumb` parts throughout (per
 *  CONTRIBUTING.md's "composition over reimplementation" rule), with no
 *  custom `className` overrides so it keeps matching that component's own
 *  canonical default story (breadcrumb.stories.tsx's "Default"). */
function renderSearchPanelBreadcrumb(
  crumbs: Array<{ label: string; onClick?: () => void }>
) {
  return (
    <Breadcrumb>
      <BreadcrumbList>
        {crumbs.flatMap((crumb, index) => {
          const isCurrent = index === crumbs.length - 1;
          const nodes = [];
          if (index > 0) nodes.push(<BreadcrumbSeparator key={`sep-${index}`} />);
          nodes.push(
            <BreadcrumbItem key={crumb.label} aria-current={isCurrent ? "page" : undefined}>
              {isCurrent ? (
                <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
              ) : (
                <BreadcrumbLink onClick={crumb.onClick}>{crumb.label}</BreadcrumbLink>
              )}
            </BreadcrumbItem>
          );
          return nodes;
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

export function useSearchPanelContent({
  tabs,
  onAddToast,
  onOpenInteraction,
  customers,
  simpleCustomerSearch,
}: UseSearchPanelContentOptions): EmbeddablePanelContent {
  const [activeTab, setActiveTab] = useState<SearchPanelTabKey>(tabs[0]);

  // Per explicit request (see `simpleCustomerSearch`'s own doc comment
  // above) — an early, completely separate return, rather than threading
  // one more condition through every branch below: this mode shares
  // NOTHING with the tabbed Contacts/Messages/Customers/Threads UI (no
  // `TabList`, no `activeTab` state is even read), so folding it into the
  // same `title`/`headerContent`/`body` ternary chain would just make an
  // already-dense set of conditions harder to follow for both modes.
  if (simpleCustomerSearch && customers) {
    return {
      // Plain-text name for the close button and the sr-only heading,
      // since `title` is a breadcrumb element.
      titleText: "Search",
      title: renderSearchPanelBreadcrumb(
        customers.selectedRow
          ? [
              { label: "Search", onClick: customers.onCloseRow },
              // Per explicit follow-up request ("the Search / Breadcrumb
              // should say 'Customer' (or Agent, Tickets, etc.) instead of
              // the name") — a generic record-TYPE label, not the specific
              // record's own name (already shown large, directly below, by
              // `CustomerFullScreenTabContent`'s own header — this crumb
              // was simply duplicating it). Hardcoded "Customer" rather
              // than derived from anything, since this branch only ever
              // renders a `CustomerListRecord` today; a future record type
              // reusing this same breadcrumb builder would pass its own
              // literal here instead.
              { label: "Customer" },
            ]
          : [{ label: "Search" }]
      ),
      headerContent: undefined,
      body: customers.selectedRow ? (
        <CustomerFullScreenTabContent
          row={customers.selectedRow}
          tabs={customers.panelTabs}
          onStartInteraction={customers.onStartInteraction}
          onAddToast={onAddToast}
          onClose={customers.onCloseRow}
        />
      ) : (
        <SimpleCustomerSearchBody customers={customers} />
      ),
    };
  }

  return {
    // Per explicit follow-up request ("have the customer record take over
    // the entire container with a breadcrumb back to search") — `title`,
    // `headerContent`, and `body` all key off the SAME condition
    // (`activeTab === "customers" && customers && customers.selectedRow`,
    // repeated in each rather than lifted to one shared `const`, so
    // TypeScript can narrow `customers`/`customers.selectedRow` to
    // non-null within each branch on its own) so a selected row takes over
    // every part of this panel at once, not just the `body` — the earlier
    // version of this feature only swapped `body` for a full-bleed overlay
    // (see that revision's own history, still in git), leaving the
    // "Search" title and Contacts/Customers/Messages/Threads `TabList`
    // sitting above it; this follow-up removes that remaining chrome
    // entirely while a record is open.
    //
    // Follow-up ("update the breadcrumb to be more generic"). The title
    // used to be a real `Breadcrumb` ONLY in the selected-row case above,
    // falling back to a flat, undifferentiated `"Search"` string the rest
    // of the time — so switching tabs (Contacts/Customers/Messages/
    // Threads) never showed which one you were actually looking at. This
    // now builds the SAME `Breadcrumb` in every case via
    // `renderSearchPanelBreadcrumb` (below) with either 2 crumbs ("Search
    // / {active tab's own label}", e.g. "Search / Customers" — matching
    // the reference screenshot) or, once a row is selected, 3 ("Search /
    // Customers / Customer" — see the trailing crumb's own doc comment,
    // just below, for why that last one reads as a generic record TYPE
    // rather than the selected customer's own name). "Search" and the
    // tab-label crumb both route through `onCloseRow` when a row is open —
    // either one returns to that tab's list, same as "Search" alone used
    // to.
    // See the `simpleCustomerSearch` branch above.
    titleText: "Search",
    title: renderSearchPanelBreadcrumb(
      activeTab === "customers" && customers && customers.selectedRow
        ? [
            { label: "Search", onClick: customers.onCloseRow },
            { label: SEARCH_PANEL_TAB_LABELS[activeTab], onClick: customers.onCloseRow },
            // Same "Customer" — not the record's own name — as the
            // `simpleCustomerSearch` breadcrumb above; see that branch's
            // own doc comment for why.
            { label: "Customer" },
          ]
        : [{ label: "Search" }, { label: SEARCH_PANEL_TAB_LABELS[activeTab] }]
    ),
    // `undefined` (no tab row at all) while a record is open — the shared
    // panel shell's own `ContainerHeader` call site (see this page's own
    // `<ContainerHeader bordered={!activePanelContent.headerContent} .../>`)
    // automatically switches to a bordered title row once `headerContent`
    // is falsy, so the breadcrumb above still gets a clean divider under it
    // with no extra styling needed here.
    headerContent:
      activeTab === "customers" && customers && customers.selectedRow ? undefined : (
        <TabList overflowMenu overflowBreakpoint="compact">
          {tabs.map((key) => (
            <Tab key={key} active={activeTab === key} onClick={() => setActiveTab(key)}>
              {SEARCH_PANEL_TAB_LABELS[key]}
            </Tab>
          ))}
        </TabList>
      ),
    body:
      activeTab === "customers" && customers && customers.selectedRow ? (
        // Reuses `CustomerFullScreenTabContent` — originally built for
        // Premium's "open customer as a desk tab" feature (§376) — as the
        // record content, rather than building a second copy of the same
        // full-width customer-record layout: it already renders the wide
        // header (name/ID, full Add Channel button row, kebab) + tabs +
        // body + Save/Cancel footer with no extra chrome to strip, and its
        // own `onClose` already renders a plain `X` `ActionIconButton`
        // (not the "close panel" `PanelRightClose` glyph `InteriorPanel`-
        // based panels use) — the second way back, alongside the
        // breadcrumb above. This is now the entire panel body (no
        // `CustomersListView`/overlay wrapper alongside it — see this
        // branch's own git history for the intermediate "overlay over the
        // table only" version this replaced), since the shared panel
        // shell's own `body` slot (this page's own `<div className="flex
        // flex-col flex-1 min-h-0 .../>` wrapper around
        // `activePanelContent.body`) already gives it the full container.
        <CustomerFullScreenTabContent
          row={customers.selectedRow}
          // Was hard-coded to `AGENT_WORKSPACE_CUSTOMER_PANEL_TABS` here —
          // safe at the time since only `AgentWorkspaceAdvancedPage.tsx`
          // ever configured `tabs` to include `"customers"`. Now threaded
          // through explicitly via `customers.panelTabs` instead (see that
          // field's own doc comment), since `simpleCustomerSearch` above
          // renders this exact same component from Premium too, and
          // Premium's own main desk-tab Customers view uses the fuller
          // `CUSTOMER_PANEL_TABS`, not this reduced set.
          tabs={customers.panelTabs}
          onStartInteraction={customers.onStartInteraction}
          onAddToast={onAddToast}
          onClose={customers.onCloseRow}
        />
      ) : activeTab === "interactions" ? (
        <InteractionsListView onAddToast={onAddToast} onOpenInteraction={onOpenInteraction} />
      ) : activeTab === "customers" && customers ? (
        <CustomersListView
          onStartInteraction={customers.onStartInteraction}
          addedFilterKeys={customers.addedFilterKeys}
          onAddedFilterKeysChange={customers.onAddedFilterKeysChange}
          filterValues={customers.filterValues}
          onFilterValuesChange={customers.onFilterValuesChange}
          onRowClick={customers.onRowClick}
          searchQuery={customers.searchQuery}
          onSearchChange={customers.onSearchChange}
          sortKey={customers.sortKey}
          sortDir={customers.sortDir}
          onSort={customers.onSort}
          sortedRows={customers.sortedRows}
          openRowId={customers.selectedRow?.contactNumber ?? null}
          // Per explicit follow-up request — this branch only ever renders
          // from Agent Workspace Advanced's own Search panel (see the doc
          // comment on `CustomerFullScreenTabContent`'s call site just
          // above), so it should get the same leading channel-icon overlay
          // as that page's main Customers desk tab already has. See
          // `leadingChannelStack`'s own doc comment (agent-next-gen-
          // customers-table.tsx) for what it does.
          leadingChannelStack
          // Same reasoning, same later follow-up ("you didn't add the icon
          // to advanced") — the eye-icon "is this customer open" column,
          // forwarded straight through from `customers.isRowOpen`.
          isRowOpen={customers.isRowOpen}
        />
      ) : (
        <div
          key={activeTab}
          className="overflow-y-auto flex-1 flex items-center justify-center p-4 animate-in fade-in-0 duration-200"
        >
          <p className="lyra-body-md text-lyra-fg-disabled text-center">Coming soon</p>
        </div>
      ),
  };
}
