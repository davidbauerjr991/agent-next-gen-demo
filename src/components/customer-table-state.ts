// The Customers table's state (P0.5d.2), shared by the Home Customers tab and
// the Search panel's Customers sub-tab so both read one list, filters, sort
// and selection.
import { useMemo, useState } from "react";
import type { SortDirection } from "@nicecxone/lyra-ui";
import { nextCustomerSortDirection } from "@/components/agent-next-gen-shared-utils";
import {
  CUSTOMER_LIST_RECORDS,
  type CustomerColKey,
  type CustomerFilterKey,
  type CustomerListRecord,
} from "@/components/agent-next-gen-customers-table";
import type { SearchPanelCustomersProps } from "@/components/agent-next-gen-search-panel";

export type CustomerTableState = Omit<SearchPanelCustomersProps, "onStartInteraction" | "onRowClick" | "isRowOpen" | "panelTabs"> & {
  setSelectedRow: (row: CustomerListRecord | null) => void;
  /** Opens a row's panel, or closes it when that row is already open. */
  toggleRow: (row: CustomerListRecord) => void;
};

/** The Customers table's search, filters, sort and selection. The page owns
 *  it (it's never unmounted), so the state survives opening an interaction
 *  or Settings and coming back, and the row panel's next/back chevrons step
 *  through the same filtered, sorted order the table shows. */
export function useCustomerTableState(): CustomerTableState {
  const [addedFilterKeys, setAddedFilterKeys] = useState<string[]>([]);
  const [filterValues, setFilterValues] = useState<Record<string, string[]>>({});
  const [selectedRow, setSelectedRow] = useState<CustomerListRecord | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  // Whether the Search panel's results list is showing (kept when the panel
  // closes and reopens).
  const [searchSubmitted, setSearchSubmitted] = useState(false);
  const [sortKey, setSortKey] = useState<CustomerColKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDirection>(null);
  const onSort = (key: CustomerColKey) => {
    if (sortKey === key) {
      const next = nextCustomerSortDirection(sortDir);
      setSortDir(next);
      if (next === null) setSortKey(null);
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };
  const sortedRows = useMemo(() => {
    const filtered = CUSTOMER_LIST_RECORDS.filter((row) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const haystack = `${row.firstName} ${row.lastName} ${row.contactNumber} ${row.emailAddress}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      for (const key of addedFilterKeys) {
        const selected = filterValues[key];
        if (selected?.length && !selected.includes(row[key as CustomerFilterKey])) return false;
      }
      return true;
    });
    return [...filtered].sort((a, b) => {
      if (!sortKey || !sortDir) return 0;
      const aVal = String(a[sortKey]).toLowerCase();
      const bVal = String(b[sortKey]).toLowerCase();
      if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [searchQuery, addedFilterKeys, filterValues, sortKey, sortDir]);
  // -1 when nothing is selected or a search/filter hid the selected row;
  // both chevrons are then disabled.
  const selectedIndex = selectedRow ? sortedRows.findIndex((r) => r.contactNumber === selectedRow.contactNumber) : -1;
  const step = (direction: 1 | -1) => {
    if (selectedIndex === -1) return;
    const next = selectedIndex + direction;
    if (next < 0 || next >= sortedRows.length) return;
    setSelectedRow(sortedRows[next]);
  };
  return {
    addedFilterKeys,
    onAddedFilterKeysChange: setAddedFilterKeys,
    filterValues,
    onFilterValuesChange: setFilterValues,
    searchQuery,
    onSearchChange: setSearchQuery,
    searchSubmitted,
    onSearchSubmittedChange: setSearchSubmitted,
    sortKey,
    sortDir,
    onSort,
    sortedRows,
    selectedRow,
    setSelectedRow,
    toggleRow: (row) => setSelectedRow((prev) => (prev?.contactNumber === row.contactNumber ? null : row)),
    onCloseRow: () => setSelectedRow(null),
    onPreviousRow: () => step(-1),
    onNextRow: () => step(1),
    hasPreviousRow: selectedIndex > 0,
    hasNextRow: selectedIndex !== -1 && selectedIndex < sortedRows.length - 1,
  };
}
