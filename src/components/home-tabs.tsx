// Home's tab strip and tab bodies (P0.5d.2, ported from Desk).
import { Tab, TabList, type ChannelType, type CreateNewOutboundContact, type EmbeddablePanelContent, type ToastItem } from "@nicecxone/lyra-ui";
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
      {tabs.customerTabs.map((tab) => (
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
      ))}
    </TabList>
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
    <div className={className} inert={inert}>
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
