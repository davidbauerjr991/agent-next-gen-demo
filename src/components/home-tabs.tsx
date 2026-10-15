// Home's tab bodies (P0.5d.2).
import type { ChannelType, CreateNewOutboundContact, ToastItem } from "@nicecxone/lyra-ui";
import { CustomersListView, type CustomerListRecord } from "@/components/agent-next-gen-customers-table";
import { CustomerRowInfoPanel, type CustomerPanelTabLabel } from "@/components/agent-next-gen-customer-info-panel";
import type { CustomerTableState } from "@/components/customer-table-state";

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
