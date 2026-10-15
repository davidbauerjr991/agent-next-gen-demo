// Home's tab strip and tab bodies (P0.5d.2, ported from Desk).
import type * as React from "react";
import {
  PageHeader,
  Tab,
  TabList,
  type ChannelType,
  type CreateNewOutboundContact,
  type EmbeddablePanelContent,
  type ToastItem,
} from "@nicecxone/lyra-ui";
import { User, X } from "lucide-react";
import { CustomersListView, type CustomerListRecord } from "@/components/agent-next-gen-customers-table";
import {
  CUSTOMER_PANEL_TABS,
  CustomerFullScreenTabContent,
  CustomerRowInfoPanel,
  type CustomerPanelTabLabel,
} from "@/components/agent-next-gen-customer-info-panel";
import type { CustomerTableState } from "@/components/customer-table-state";
import { HOME_APP_TAB_LABELS, keptMountedClass, type HomeTabs } from "@/components/home-tabs-state";
import type { ExtraHeaderApp } from "@/settings";
import { cn } from "@/lib/utils";

/** Dashboard, the tab-placed apps (draggable), then the closable customer
 *  tabs. Dashboard has no `key`, so it can't be dragged and stays first. */
export function HomeTabStrip({
  tabs,
  apps,
  onReorder,
}: {
  tabs: HomeTabs;
  apps: readonly ExtraHeaderApp[];
  onReorder: (order: string[]) => void;
}) {
  return (
    <TabList overflowMenu reorderable onReorder={onReorder} className="px-6 bg-lyra-bg-surface-base shrink-0" data-slot="home-tabs">
      <Tab active={tabs.activeTab === "dashboard"} onClick={() => tabs.setActiveTab("dashboard")}>
        Dashboard
      </Tab>
      {apps.map((app) => (
        <Tab key={app} active={tabs.activeTab === app} onClick={() => tabs.setActiveTab(app)}>
          {HOME_APP_TAB_LABELS[app]}
        </Tab>
      ))}
      {customerTabElements(tabs)}
    </TabList>
  );
}

/** The closable customer tabs (a function, not a component: `TabList`
 *  needs its `Tab`s as direct children). */
function customerTabElements(tabs: HomeTabs) {
  return tabs.customerTabs.map((tab) => (
    <Tab
      key={tab.id}
      active={tabs.activeTab === tab.id}
      onClick={() => tabs.setActiveTab(tab.id)}
      icon={<User className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />}
      onRemove={() => tabs.closeCustomer(tab.id)}
      // Closing stops viewing the customer; it deletes nothing, so an X, not a trash can.
      removeIcon={<X className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />}
      removeLabel={`Close ${tab.name}`}
    >
      {tab.name}
    </Tab>
  ));
}

/** An app placed in the left nav, as a page in the main column (like Home
 *  and Settings): a page header over the app's body. */
export function LeftNavAppPage({ title, showHeader, children }: { title: string; showHeader: boolean; children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col min-w-0 overflow-hidden animate-in fade-in-0 duration-200" data-slot="left-nav-page" data-app={title}>
      {showHeader && <PageHeader title={title} />}
      {/* Positioned, scrolling sideways, and its own stacking context
          (`isolate`): lyra's table resize handles (z-10) stay inside the
          page instead of painting over the left nav's hover overlay. */}
      <div className="relative isolate flex flex-1 overflow-x-auto overflow-y-hidden">{children}</div>
    </div>
  );
}

/** The Customers app as a left-nav page: the table and row panel, plus a tab
 *  row once a customer is open full screen ("Open Tab"). */
export function CustomersPage({
  tabs,
  table,
  onStartInteraction,
  onAddToast,
  isRowOpen,
}: {
  tabs: HomeTabs;
  table: CustomerTableState;
  onStartInteraction: (contact: CreateNewOutboundContact, channel: ChannelType, phone: string, skillId: string) => void;
  onAddToast: (toast: Omit<ToastItem, "id">) => void;
  isRowOpen: (row: CustomerListRecord) => boolean;
}) {
  const onList = !tabs.activeTab.startsWith("customer:");
  return (
    <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
      {tabs.customerTabs.length > 0 && (
        <TabList className="px-6 bg-lyra-bg-surface-base shrink-0">
          <Tab active={onList} onClick={() => tabs.setActiveTab("customers")}>
            Customers
          </Tab>
          {customerTabElements(tabs)}
        </TabList>
      )}
      <div className="relative flex flex-1 overflow-hidden">
        <CustomersTabBody
          className={keptMountedClass(onList)}
          inert={!onList}
          table={table}
          tabs={CUSTOMER_PANEL_TABS}
          onStartInteraction={onStartInteraction}
          onAddToast={onAddToast}
          onRowClick={table.toggleRow}
          onOpenFullScreenTab={tabs.openCustomer}
          isRowOpen={(row) => isRowOpen(row) || tabs.customerTabs.some((t) => t.row.contactNumber === row.contactNumber)}
        />
        <CustomerTabBodies tabs={tabs} onStartInteraction={onStartInteraction} onAddToast={onAddToast} />
      </div>
    </div>
  );
}

/** One customer per tab, opened full screen from the Customers tab. */
export function CustomerTabBodies({
  tabs,
  onStartInteraction,
  onAddToast,
}: {
  tabs: HomeTabs;
  onStartInteraction: (contact: CreateNewOutboundContact, channel: ChannelType, phone: string, skillId: string) => void;
  onAddToast: (toast: Omit<ToastItem, "id">) => void;
}) {
  return (
    <>
      {tabs.customerTabs.map((tab) => (
        <div key={tab.id} className={keptMountedClass(tabs.activeTab === tab.id)} inert={tabs.activeTab !== tab.id}>
          <CustomerFullScreenTabContent
            row={tab.row}
            tabs={CUSTOMER_PANEL_TABS}
            onStartInteraction={onStartInteraction}
            onAddToast={onAddToast}
            onClose={() => tabs.closeCustomer(tab.id)}
          />
        </div>
      ))}
    </>
  );
}

/** An app placed as a tab shows the same content its header panel would. */
export function AppTabBody({ content }: { content: EmbeddablePanelContent }) {
  return (
    <div className="flex flex-1 flex-col min-w-0 overflow-hidden animate-in fade-in-0 duration-200" data-slot="home-app-tab">
      {content.headerContent && (
        <div className="shrink-0 border-b border-lyra-border-subtle px-6 pt-3 pb-3">{content.headerContent}</div>
      )}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">{content.body}</div>
    </div>
  );
}

export interface CustomersTabBodyProps {
  table: CustomerTableState;
  /** The row panel's tabs. */
  tabs: readonly CustomerPanelTabLabel[];
  onStartInteraction: (contact: CreateNewOutboundContact, channel: ChannelType, phone: string, skillId: string) => void;
  onAddToast: (toast: Omit<ToastItem, "id">) => void;
  onRowClick: (row: CustomerListRecord) => void;
  /** Shows the eye icon on a row that's open as an assignment or a tab. */
  isRowOpen: (row: CustomerListRecord) => boolean;
  /** The row panel's full-screen button opens the customer as a Home tab. */
  onOpenFullScreenTab?: (row: CustomerListRecord) => void;
  className?: string;
  inert?: boolean;
}

/** The Customers table with its row panel docked to the right. */
export function CustomersTabBody({
  table,
  tabs,
  onStartInteraction,
  onAddToast,
  onRowClick,
  isRowOpen,
  onOpenFullScreenTab,
  className = "relative flex flex-1 overflow-hidden animate-in fade-in-0 duration-200",
  inert,
}: CustomersTabBodyProps) {
  return (
    // `isolate`: the table's resize handles (lyra, z-10) stack inside this
    // body, never over the left nav's hover overlay.
    <div className={cn(className, "isolate")} inert={inert}>
      <CustomersListView
        onStartInteraction={onStartInteraction}
        addedFilterKeys={table.addedFilterKeys}
        onAddedFilterKeysChange={table.onAddedFilterKeysChange}
        filterValues={table.filterValues}
        onFilterValuesChange={table.onFilterValuesChange}
        onRowClick={onRowClick}
        searchQuery={table.searchQuery}
        onSearchChange={table.onSearchChange}
        sortKey={table.sortKey}
        sortDir={table.sortDir}
        onSort={table.onSort}
        sortedRows={table.sortedRows}
        openRowId={table.selectedRow?.contactNumber ?? null}
        leadingChannelStack
        isRowOpen={isRowOpen}
      />
      <CustomerRowInfoPanel
        row={table.selectedRow}
        onClose={table.onCloseRow}
        onPrevious={table.onPreviousRow}
        onNext={table.onNextRow}
        hasPrevious={table.hasPreviousRow}
        hasNext={table.hasNextRow}
        onStartInteraction={onStartInteraction}
        tabs={tabs}
        onAddToast={onAddToast}
        onOpenFullScreenTab={onOpenFullScreenTab}
        hidePrevNext
      />
    </div>
  );
}
